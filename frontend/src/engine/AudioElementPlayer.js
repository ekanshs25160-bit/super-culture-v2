import { PlayerState } from './PlayerConstants.js';
import { apiClient, API_BASE } from '../services/api.js';

// Signed stream tokens live 2h; keep preloaded URLs well inside that window
const PRELOAD_MAX_AGE_MS = 90 * 60 * 1000;

export const resolveAudioUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${API_BASE}${url}`;
};

/**
 * AudioElementPlayer
 * High-performance, mobile-optimized HTMLAudioElement wrapper providing
 * identical API methods to the YouTube IFrame player for seamless AudioContext compatibility.
 */
export class AudioElementPlayer {
  constructor(options = {}) {
    this.options = options;
    this.audio = null;
    this.preloadAudio = null;
    this.state = PlayerState.UNSTARTED;
    this.listeners = new Map();
    this.currentVideoId = null;
    this.currentSrc = null;
    this.currentBlobUrl = null;
    this.cuedOnly = false;
    this.hasRetried = false;
    this.isRefreshing = false;
    this.userPaused = false;
    this._lastKnownTime = 0;
    this.volume = 0.74;
    this.urlCache = new Map(); // videoId -> { url, timestamp }
    this.loadPromise = null;
    this.loadToken = 0;
    // Next-track stream URL resolved ahead of time so the ended -> src -> play() chain needs no network await
    this._preloadedNext = { videoId: null, url: null };
    this._preloadInflight = null;
    this.errorReportedFor = null;
    this.unlocked = false;
    this.isUnlocking = false;

    this.initAudioElement();
  }

  initAudioElement() {
    if (typeof document === 'undefined') return;

    if (!this.audio) {
      this.audio = document.createElement('audio');
      this.audio.id = 'sc-native-audio-engine';
      this.audio.playsInline = true;
      this.audio.preload = 'auto';
      this.audio.style.display = 'none';
      document.body.appendChild(this.audio);

      this.attachEventListeners(this.audio);
    }

    if (!this.preloadAudio) {
      this.preloadAudio = document.createElement('audio');
      this.preloadAudio.id = 'sc-native-audio-preload';
      this.preloadAudio.playsInline = true;
      this.preloadAudio.preload = 'none';
      this.preloadAudio.style.display = 'none';
      document.body.appendChild(this.preloadAudio);
    }
  }

  /**
   * One-time user gesture audio unlock for Mobile Safari and WebView autoplay restrictions.
   * Called synchronously at the start of a user tap handler before any async/await operations.
   */
  unlock() {
    this.initAudioElement();
    if (this.unlocked || !this.audio) return;
    this.unlocked = true;
    this.isUnlocking = true;

    try {
      // Tiny valid silent WAV (4-byte 16-bit PCM mono silence) to bless the audio element
      this.audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAA';
      const playPromise = this.audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            if (this.audio && this.audio.src && this.audio.src.startsWith('data:audio')) {
              this.audio.pause();
            }
            this.isUnlocking = false;
          })
          .catch(() => {
            this.isUnlocking = false;
          });
      } else {
        if (this.audio && this.audio.src && this.audio.src.startsWith('data:audio')) {
          this.audio.pause();
        }
        this.isUnlocking = false;
      }
    } catch {
      this.isUnlocking = false;
    }
  }

  attachEventListeners(audio) {
    audio.addEventListener('playing', () => {
      if (audio.src?.startsWith('data:audio')) return;
      this.isUnlocking = false;
      this.state = PlayerState.PLAYING;
      this.emit('onPlaying');
      this.emit('onStateChange', PlayerState.PLAYING);
    });

    audio.addEventListener('pause', () => {
      if (audio.src?.startsWith('data:audio')) return;
      // Avoid firing paused when playback naturally ended
      if (this.state !== PlayerState.ENDED) {
        this.state = PlayerState.PAUSED;
        this.emit('onPaused');
        this.emit('onStateChange', PlayerState.PAUSED);
      }
    });

    audio.addEventListener('waiting', () => {
      if (audio.src?.startsWith('data:audio')) return;
      this.state = PlayerState.BUFFERING;
      this.emit('onBuffering');
      this.emit('onStateChange', PlayerState.BUFFERING);
    });

    audio.addEventListener('ended', () => {
      if (audio.src?.startsWith('data:audio')) return;
      this._lastKnownTime = 0;
      this.state = PlayerState.ENDED;
      this.emit('onEnded');
      this.emit('onStateChange', PlayerState.ENDED);
    });

    audio.addEventListener('timeupdate', () => {
      if (audio.src?.startsWith('data:audio')) return;
      if (audio.currentTime > 0 && !this.isRefreshing) {
        this._lastKnownTime = audio.currentTime;
      }
      this.emit('onTimeUpdate', audio.currentTime, audio.duration);
    });

    audio.addEventListener('error', (e) => {
      if (audio.src?.startsWith('data:audio')) return;
      this.handleAudioError(e);
    });

    audio.addEventListener('stalled', () => {
      if (audio.src?.startsWith('data:audio')) return;
      this.handleStreamStall();
    });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  emit(event, ...args) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(...args);
        } catch (err) {
          console.warn(`[AudioElementPlayer] Error in ${event} listener:`, err);
        }
      });
    }
  }

  reportError(code, err, videoId = this.currentVideoId) {
    const targetId = videoId || this.currentVideoId || 'unknown';
    if (this.errorReportedFor === targetId) {
      return;
    }
    if (this.audio && this.audio.currentTime > 0) {
      this._lastKnownTime = this.audio.currentTime;
    }
    this.hasRetried = true;
    this.errorReportedFor = targetId;
    this.state = PlayerState.UNSTARTED;
    this.emit('onError', code, err);
  }

  /**
   * Pre-fetches and caches signed stream URL for instant synchronous playback without network wait
   */
  async prepareTrack(videoId) {
    if (!videoId) return null;

    const cached = this.urlCache.get(videoId);
    if (cached && Date.now() - cached.timestamp < 100 * 60 * 1000) {
      return cached.url;
    }

    try {
      const data = await apiClient.music.getStreamUrl(videoId, 'aac');
      const rawUrl = data?.url || (typeof data === 'string' ? data : '');
      const resolved = resolveAudioUrl(rawUrl);
      const throttled = Boolean(data?.throttled || data?.code === 'STREAM_LIMITED');
      const reason = data?.reason || null;
      this.urlCache.set(videoId, { url: resolved, throttled, reason, timestamp: Date.now() });
      return resolved;
    } catch (err) {
      console.warn(`[AudioElementPlayer] prepareTrack failed for ${videoId}:`, err);
      return null;
    }
  }

  /**
   * Resolves the signed stream URL (and offline blob, if saved) for the upcoming track in the background
   * so loadVideoById() can assign src and call play() synchronously when the current track ends.
   */
  async preloadNextStreamUrl(videoId) {
    if (!videoId || videoId === this.currentVideoId) return null;

    const existing = this._preloadedNext;
    if (
      existing.videoId === videoId &&
      existing.url &&
      Date.now() - (existing.timestamp || 0) < PRELOAD_MAX_AGE_MS
    ) {
      return existing.url;
    }
    if (this._preloadInflight?.videoId === videoId) {
      return this._preloadInflight.promise;
    }

    const promise = (async () => {
      try {
        let url = null;
        let isBlob = false;
        let throttled = false;
        let reason = null;

        if (typeof caches !== 'undefined') {
          try {
            const cache = await caches.open('sc-offline-audio');
            const match = await cache.match(`/offline-audio/${videoId}`);
            const blob = match ? await match.blob() : null;
            if (blob && blob.size > 0) {
              url = URL.createObjectURL(blob);
              isBlob = true;
            }
          } catch (cacheErr) {
            void cacheErr;
          }
        }

        if (!url) {
          const data = await apiClient.music.getStreamUrl(videoId, 'aac');
          const rawUrl = data?.url || (typeof data === 'string' ? data : '');
          url = resolveAudioUrl(rawUrl);
          throttled = Boolean(data?.throttled || data?.code === 'STREAM_LIMITED');
          reason = data?.reason || null;
          if (url) {
            this.urlCache.set(videoId, { url, throttled, reason, timestamp: Date.now() });
          }
        }

        if (!url) return null;
        this._clearPreloadedNext();
        this._preloadedNext = { videoId, url, isBlob, throttled, reason, timestamp: Date.now() };
        return url;
      } catch (err) {
        console.debug('[AudioElementPlayer] preloadNextStreamUrl skipped:', err?.message);
        return null;
      } finally {
        if (this._preloadInflight?.videoId === videoId) {
          this._preloadInflight = null;
        }
      }
    })();

    this._preloadInflight = { videoId, promise };
    return promise;
  }

  _clearPreloadedNext({ revoke = true } = {}) {
    const prev = this._preloadedNext;
    if (revoke && prev?.isBlob && prev.url) {
      try {
        URL.revokeObjectURL(prev.url);
      } catch (revokeErr) {
        void revokeErr;
      }
    }
    this._preloadedNext = { videoId: null, url: null };
  }

  /**
   * Assigns src and starts playback. Everything before audio.play() is synchronous.
   */
  async _applySrcAndPlay({ token, targetSrc, startSeconds, videoId }) {
    this.currentSrc = targetSrc;
    this.isUnlocking = false;

    if (!this.audio) return;
    this.audio.src = targetSrc;
    if (typeof this.audio.load === 'function') {
      this.audio.load();
    }
    try {
      this.audio.currentTime = startSeconds || 0;
    } catch {
      // Ignore if metadata is not yet loaded on native WebView
    }
    if (token !== this.loadToken) return;
    try {
      await this.audio.play();
    } catch (playErr) {
      if (token !== this.loadToken) return;
      if (playErr?.name === 'NotAllowedError') {
        console.warn('[AudioElementPlayer] Autoplay blocked by user-gesture policy.');
        this.emit('onAutoplayBlocked');
      } else if (playErr?.name === 'AbortError' && (this.userPaused || this.isRefreshing) && !this.audio?.error) {
        // Interrupted by explicit user pause or in-flight URL refresh
      } else if (!this.hasRetried && !this.isRefreshing) {
        await this.handleStreamStall();
      } else {
        console.warn('[AudioElementPlayer] loadVideoById play error:', playErr);
        this.reportError(100, playErr, videoId);
      }
    }
  }

  /**
   * Loads and plays audio for a YouTube videoId using the secure backend stream URL or offline Cache API
   */
  async loadVideoById({ videoId, startSeconds = 0 } = {}) {
    const token = ++this.loadToken;
    this.errorReportedFor = null;

    if (!videoId) return;

    this.currentVideoId = videoId;
    this.cuedOnly = false;
    this.hasRetried = false;
    this.isRefreshing = false;
    this.userPaused = false;
    this._lastKnownTime = Math.max(0, Number(startSeconds) || 0);
    this.state = PlayerState.BUFFERING;
    this.emit('onBuffering');
    this.emit('onStateChange', PlayerState.BUFFERING);

    this.initAudioElement();

    // Revoke previous blob URL if created to release memory
    if (this.currentBlobUrl) {
      try {
        URL.revokeObjectURL(this.currentBlobUrl);
      } catch (_revokeErr) {
        void _revokeErr;
      }
      this.currentBlobUrl = null;
    }

    // Synchronous fast-path: next-track URL was pre-resolved, so ZERO await statements precede src/load()/play().
    const pre = this._preloadedNext;
    const cachedEntry = this.urlCache.get(videoId);
    const fastPreload =
      pre.videoId === videoId &&
      pre.url &&
      !pre.throttled &&
      Date.now() - (pre.timestamp || 0) < PRELOAD_MAX_AGE_MS
        ? pre
        : cachedEntry &&
            cachedEntry.url &&
            !cachedEntry.throttled &&
            Date.now() - (cachedEntry.timestamp || 0) < PRELOAD_MAX_AGE_MS
          ? {
              videoId,
              url: cachedEntry.url,
              isBlob: false,
              throttled: false,
              timestamp: cachedEntry.timestamp,
            }
          : null;

    if (fastPreload) {
      if (pre.videoId === videoId) {
        this._preloadedNext = { videoId: null, url: null };
      }
      if (fastPreload.isBlob) {
        this.currentBlobUrl = fastPreload.url;
      }
      const fastTask = this._applySrcAndPlay({
        token,
        targetSrc: fastPreload.url,
        startSeconds,
        videoId,
      })
        .catch((err) => {
          if (token !== this.loadToken) return;
          console.error('[AudioElementPlayer] Failed to start preloaded stream:', err);
          this.reportError(100, err, videoId);
        })
        .finally(() => {
          if (this.loadToken === token) {
            this.loadPromise = null;
          }
        });
      this.loadPromise = fastTask;
      return fastTask;
    }
    if (pre.videoId === videoId) {
      // Stale or throttled preload: drop it and take the normal slow path
      this._clearPreloadedNext();
    }

    const loadTask = (async () => {
      try {
        // 1. Check offline Cache API for saved audio blob
        let offlineBlobUrl = null;
        if (typeof caches !== 'undefined') {
          try {
            const cache = await caches.open('sc-offline-audio');
            if (token !== this.loadToken) return;
            const match = await cache.match(`/offline-audio/${videoId}`);
            if (token !== this.loadToken) return;
            if (match) {
              const blob = await match.blob();
              if (token !== this.loadToken) return;
              if (blob && blob.size > 0) {
                offlineBlobUrl = URL.createObjectURL(blob);
                this.currentBlobUrl = offlineBlobUrl;
              }
            }
          } catch (cacheErr) {
            console.warn('[AudioElementPlayer] Offline cache check failed:', cacheErr);
          }
        }
        if (token !== this.loadToken) return;

        let targetSrc = offlineBlobUrl;
        let isThrottled = false;

        // 2. Check in-memory URL cache for instant screen-off transition
        if (!targetSrc) {
          const cached = this.urlCache.get(videoId);
          if (cached && Date.now() - cached.timestamp < 100 * 60 * 1000) {
            targetSrc = cached.url;
            isThrottled = Boolean(cached.throttled);
          }
        }

        // 3. Fallback to network request if not pre-cached
        if (!targetSrc && !isThrottled) {
          targetSrc = await this.prepareTrack(videoId);
          if (token !== this.loadToken) return;
          const cached = this.urlCache.get(videoId);
          if (cached) {
            isThrottled = Boolean(cached.throttled);
          }
        }

        if (token !== this.loadToken) return;

        // If upstream stream is subject to the 1 MiB PO cap, route immediately to YouTube compatibility player at 0s
        if (isThrottled) {
          console.log(`[AudioElementPlayer] Stream for ${videoId} is throttled upstream (>1 MiB PO cap). Routing to YouTube compatibility player at 0s...`);
          this.state = PlayerState.UNSTARTED;
          this.hasRetried = true;
          this._lastKnownTime = Math.max(0, Number(startSeconds) || 0);

          const fallbackPayload = {
            videoId,
            seconds: this._lastKnownTime,
            reason: 'Stream throttled by YouTube • Compatibility mode (YouTube)',
          };

          if (typeof this.options?.onUnrecoverable === 'function') {
            this.options.onUnrecoverable(fallbackPayload);
          }
          this.emit('onThrottled', fallbackPayload);
          this.emit('onUnrecoverable', fallbackPayload);
          return;
        }

        if (!targetSrc) {
          throw new Error('Failed to resolve audio stream source');
        }

        await this._applySrcAndPlay({ token, targetSrc, startSeconds, videoId });
      } catch (err) {
        if (token !== this.loadToken) return;
        console.error('[AudioElementPlayer] Failed to load stream URL:', err);
        this.reportError(100, err, videoId);
      } finally {
        if (this.loadToken === token) {
          this.loadPromise = null;
        }
      }
    })();

    this.loadPromise = loadTask;
    return loadTask;
  }

  async cueVideoById({ videoId, startSeconds = 0 } = {}) {
    if (!videoId) return;
    this.currentVideoId = videoId;
    this._lastKnownTime = Math.max(0, Number(startSeconds) || 0);
    this.cuedOnly = true;
    this.hasRetried = false;
    this.isRefreshing = false;
    this.userPaused = true;
    this.state = PlayerState.CUED;
    this.emit('onStateChange', PlayerState.CUED);
  }

  async playVideo() {
    this.initAudioElement();
    if (!this.audio) return;

    const needsInitialLoad =
      this.cuedOnly ||
      ((!this.audio.src || this.audio.src.startsWith('data:audio')) &&
        Boolean(this.currentVideoId) &&
        !this.loadPromise);

    if (needsInitialLoad && this.currentVideoId) {
      this.cuedOnly = false;
      return this.loadVideoById({
        videoId: this.currentVideoId,
        startSeconds: this._lastKnownTime || 0,
      });
    }

    this.userPaused = false;

    try {
      if (this.loadPromise) {
        await this.loadPromise;
      }

      if (this.userPaused || !this.audio.src || this.audio.src.startsWith('data:audio')) {
        return;
      }

      if (this.audio.error) {
        if (!this.hasRetried && !this.isRefreshing && this.currentVideoId) {
          await this.handleStreamStall();
        } else {
          this.reportError(100, this.audio.error, this.currentVideoId);
        }
        return;
      }

      await this.audio.play();
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        console.warn('[AudioElementPlayer] Autoplay blocked by user-gesture policy.');
        this.emit('onAutoplayBlocked');
      } else if (err?.name === 'AbortError' && (this.userPaused || this.isRefreshing) && !this.audio?.error) {
        // Interrupted by explicit user pause or in-flight URL refresh
      } else {
        console.warn('[AudioElementPlayer] playVideo error:', err);
        this.reportError(100, err, this.currentVideoId);
      }
    }
  }

  pauseVideo() {
    this.userPaused = true;
    if (this.audio) {
      this.audio.pause();
    }
  }

  stopVideo() {
    this.loadToken++;
    this.loadPromise = null;
    this.cuedOnly = false;
    this.userPaused = true;
    this.isRefreshing = false;
    this._lastKnownTime = 0;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.state = PlayerState.UNSTARTED;
    }
  }

  seekTo(seconds) {
    const target = Math.max(0, Number(seconds) || 0);
    this._lastKnownTime = target;
    if (this.cuedOnly || !this.audio || this.audio.src?.startsWith('data:audio')) {
      return;
    }
    try {
      this.audio.currentTime = target;
    } catch (err) {
      console.warn('[AudioElementPlayer] Seek error:', err);
    }
  }

  setVolume(volume0to100) {
    this.volume = Math.max(0, Math.min(100, volume0to100)) / 100;
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  getVolume() {
    if (this.audio) {
      return Math.round(this.audio.volume * 100);
    }
    return Math.round(this.volume * 100);
  }

  getCurrentTime() {
    const audioTime = this.audio ? this.audio.currentTime || 0 : 0;
    if (audioTime > 0) {
      this._lastKnownTime = audioTime;
      return audioTime;
    }
    return this._lastKnownTime || 0;
  }

  getDuration() {
    return this.audio && !isNaN(this.audio.duration) ? this.audio.duration : 0;
  }

  getPlayerState() {
    return this.state;
  }

  /**
   * Preload the next queue item's stream URL without exceeding mobile data limits
   */
  async preloadNextTrack(nextTrack) {
    if (!nextTrack || !nextTrack.videoId) return;

    // Respect mobile data saver
    if (
      typeof navigator !== 'undefined' &&
      navigator.connection &&
      navigator.connection.saveData
    ) {
      return;
    }

    try {
      // Warm memory urlCache and HTMLAudio preload buffer
      const resolved = await this.prepareTrack(nextTrack.videoId);
      if (resolved && this.preloadAudio) {
        this.preloadAudio.src = resolved;
        this.preloadAudio.preload = 'auto';
        this.preloadAudio.load();
      }
    } catch (err) {
      // Non-critical background failure
      console.debug('[AudioElementPlayer] Preload next track skipped:', err.message);
    }
  }

  /**
   * Recover from stream stalls or token expiry (HTTP 410) by re-requesting stream URL once
   */
  async handleStreamStall() {
    if (this.hasRetried || this.isRefreshing || !this.currentVideoId) return false;
    this.hasRetried = true;
    this.isRefreshing = true;

    const videoId = this.currentVideoId;
    const resumeTime = this.getCurrentTime();
    if (resumeTime > 0) {
      this._lastKnownTime = resumeTime;
    }
    console.log(`[AudioElementPlayer] Stream stalled or token expired. Refreshing signed URL for ${videoId} at ${resumeTime}s...`);

    // Invalidate cached URL so fresh HMAC token is fetched
    this.urlCache.delete(videoId);

    try {
      const freshUrl = await this.prepareTrack(videoId);
      if (this.currentVideoId !== videoId) return false;
      if (!freshUrl) {
        throw new Error('Could not refresh stream URL');
      }

      this.currentSrc = freshUrl;
      if (this.audio) {
        this.audio.src = freshUrl;
        this.audio.currentTime = resumeTime;
        if (!this.userPaused) {
          const playPromise = this.audio.play();
          if (playPromise && typeof playPromise.then === 'function') {
            await playPromise;
          }
        }
      }
      return true;
    } catch (err) {
      if (this.currentVideoId !== videoId) return false;
      if (err?.name === 'NotAllowedError') {
        console.warn('[AudioElementPlayer] Autoplay blocked by user-gesture policy.');
        this.emit('onAutoplayBlocked');
        return false;
      }
      if (err?.name === 'AbortError' && this.userPaused && !this.audio?.error) {
        return false;
      }
      if (this.errorReportedFor !== videoId) {
        console.warn('[AudioElementPlayer] Re-request on stall failed:', err);
      }
      this.reportError(101, err, videoId);
      return false;
    } finally {
      if (this.currentVideoId === videoId) {
        this.isRefreshing = false;
      }
    }
  }

  handleAudioError(e) {
    if (this.audio && this.audio.currentTime > 0) {
      this._lastKnownTime = this.audio.currentTime;
    }

    if (!this.hasRetried && this.currentVideoId) {
      this.handleStreamStall();
      return;
    }

    this.reportError(100, e, this.currentVideoId);
  }

  destroy() {
    this.loadToken++;
    this.loadPromise = null;
    this._clearPreloadedNext();
    this.unlocked = false;
    this.isUnlocking = false;
    this.isRefreshing = false;
    this.userPaused = false;
    this._lastKnownTime = 0;
    if (this.currentBlobUrl) {
      try {
        URL.revokeObjectURL(this.currentBlobUrl);
      } catch (_err) {
        void _err;
      }
      this.currentBlobUrl = null;
    }

    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      if (this.audio.parentNode) {
        this.audio.parentNode.removeChild(this.audio);
      }
      this.audio = null;
    }

    if (this.preloadAudio) {
      this.preloadAudio.src = '';
      if (this.preloadAudio.parentNode) {
        this.preloadAudio.parentNode.removeChild(this.preloadAudio);
      }
      this.preloadAudio = null;
    }

    this.listeners.clear();
  }
}

export default AudioElementPlayer;
