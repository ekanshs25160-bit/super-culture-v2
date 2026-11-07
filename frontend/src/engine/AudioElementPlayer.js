import { PlayerState } from './PlayerConstants.js';
import { apiClient, API_BASE } from '../services/api.js';

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
    this.hasRetried = false;
    this.isRefreshing = false;
    this.userPaused = false;
    this._lastKnownTime = 0;
    this.volume = 0.74;
    this.urlCache = new Map(); // videoId -> { url, timestamp }
    this.loadPromise = null;
    this.loadToken = 0;
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
    } catch (_err) {
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
      const { url } = await apiClient.music.getStreamUrl(videoId, 'aac');
      const resolved = resolveAudioUrl(url);
      this.urlCache.set(videoId, { url: resolved, timestamp: Date.now() });
      return resolved;
    } catch (err) {
      console.warn(`[AudioElementPlayer] prepareTrack failed for ${videoId}:`, err);
      return null;
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

        // 2. Check in-memory URL cache for instant screen-off transition
        if (!targetSrc) {
          const cached = this.urlCache.get(videoId);
          if (cached && Date.now() - cached.timestamp < 100 * 60 * 1000) {
            targetSrc = cached.url;
          }
        }

        // 3. Fallback to network request if not pre-cached
        if (!targetSrc) {
          targetSrc = await this.prepareTrack(videoId);
          if (token !== this.loadToken) return;
        }

        if (!targetSrc) {
          throw new Error('Failed to resolve audio stream source');
        }

        this.currentSrc = targetSrc;
        this.isUnlocking = false;

        if (this.audio) {
          this.audio.src = targetSrc;
          this.audio.currentTime = startSeconds || 0;
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
          if (token !== this.loadToken) return;
        }
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

  async cueVideoById({ videoId, startSeconds = 0 }) {
    this.currentVideoId = videoId;
    this.hasRetried = false;
    this.isRefreshing = false;
    this.userPaused = false;
    this._lastKnownTime = Math.max(0, Number(startSeconds) || 0);
    this.state = PlayerState.CUED;
    this.emit('onStateChange', PlayerState.CUED);

    this.initAudioElement();

    if (this.currentBlobUrl) {
      try {
        URL.revokeObjectURL(this.currentBlobUrl);
      } catch (_revokeErr) {
        void _revokeErr;
      }
      this.currentBlobUrl = null;
    }

    let offlineBlobUrl = null;
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open('sc-offline-audio');
        const match = await cache.match(`/offline-audio/${videoId}`);
        if (match) {
          const blob = await match.blob();
          if (blob && blob.size > 0) {
            offlineBlobUrl = URL.createObjectURL(blob);
            this.currentBlobUrl = offlineBlobUrl;
          }
        }
      } catch (_cacheErr) {
        void _cacheErr;
      }
    }

    try {
      let targetSrc = offlineBlobUrl;
      if (!targetSrc) {
        const cached = this.urlCache.get(videoId);
        if (cached && Date.now() - cached.timestamp < 100 * 60 * 1000) {
          targetSrc = cached.url;
        } else {
          targetSrc = await this.prepareTrack(videoId);
        }
      }

      this.currentSrc = targetSrc;
      if (this.audio && targetSrc) {
        this.audio.src = targetSrc;
        if (startSeconds > 0) {
          this.audio.currentTime = startSeconds;
        }
      }
    } catch (err) {
      console.warn('[AudioElementPlayer] Failed to cue stream URL:', err);
    }
  }

  async playVideo() {
    if (!this.audio) return;
    this.userPaused = false;

    try {
      if (this.loadPromise) {
        await this.loadPromise;
      }

      if (this.userPaused || !this.audio.src) {
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
    if (!this.audio) return;
    const target = Math.max(0, Number(seconds) || 0);
    this._lastKnownTime = target;
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
