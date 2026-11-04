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
    this.volume = 0.74;
    this.urlCache = new Map(); // videoId -> { url, timestamp }
    this.loadPromise = null;
    this.loadToken = 0;
    this.errorReportedFor = null;

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

  attachEventListeners(audio) {
    audio.addEventListener('playing', () => {
      this.state = PlayerState.PLAYING;
      this.emit('onPlaying');
      this.emit('onStateChange', PlayerState.PLAYING);
    });

    audio.addEventListener('pause', () => {
      // Avoid firing paused when playback naturally ended
      if (this.state !== PlayerState.ENDED) {
        this.state = PlayerState.PAUSED;
        this.emit('onPaused');
        this.emit('onStateChange', PlayerState.PAUSED);
      }
    });

    audio.addEventListener('waiting', () => {
      this.state = PlayerState.BUFFERING;
      this.emit('onBuffering');
      this.emit('onStateChange', PlayerState.BUFFERING);
    });

    audio.addEventListener('ended', () => {
      this.state = PlayerState.ENDED;
      this.emit('onEnded');
      this.emit('onStateChange', PlayerState.ENDED);
    });

    audio.addEventListener('timeupdate', () => {
      this.emit('onTimeUpdate', audio.currentTime, audio.duration);
    });

    audio.addEventListener('error', (e) => {
      this.handleAudioError(e);
    });

    audio.addEventListener('stalled', () => {
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

        if (this.audio) {
          this.audio.src = targetSrc;
          this.audio.currentTime = startSeconds || 0;
          if (token !== this.loadToken) return;
          try {
            await this.audio.play();
          } catch (playErr) {
            if (token !== this.loadToken) return;
            if (playErr.name === 'NotAllowedError') {
              console.warn('[AudioElementPlayer] Autoplay blocked by user-gesture policy.');
              this.emit('onAutoplayBlocked');
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

    try {
      if (this.loadPromise) {
        await this.loadPromise;
      }

      if (this.audio.error || !this.audio.src) {
        return;
      }

      await this.audio.play();
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        console.warn('[AudioElementPlayer] Autoplay blocked by user-gesture policy.');
        this.emit('onAutoplayBlocked');
      } else {
        console.warn('[AudioElementPlayer] playVideo error:', err);
        this.reportError(100, err, this.currentVideoId);
      }
    }
  }

  pauseVideo() {
    if (this.audio) {
      this.audio.pause();
    }
  }

  stopVideo() {
    this.loadToken++;
    this.loadPromise = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.state = PlayerState.UNSTARTED;
    }
  }

  seekTo(seconds) {
    if (!this.audio) return;
    try {
      this.audio.currentTime = seconds;
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
    return this.audio ? this.audio.currentTime || 0 : 0;
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
    if (this.hasRetried || !this.currentVideoId) return;
    this.hasRetried = true;

    const resumeTime = this.getCurrentTime();
    console.log(`[AudioElementPlayer] Stream stalled or token expired. Refreshing signed URL for ${this.currentVideoId} at ${resumeTime}s...`);

    // Invalidate cached URL so fresh HMAC token is fetched
    this.urlCache.delete(this.currentVideoId);

    try {
      const freshUrl = await this.prepareTrack(this.currentVideoId);
      if (!freshUrl) {
        throw new Error('Could not refresh stream URL');
      }
      this.currentSrc = freshUrl;
      if (this.audio) {
        this.audio.src = freshUrl;
        this.audio.currentTime = resumeTime;
        await this.playVideo();
      }
    } catch (err) {
      console.warn('[AudioElementPlayer] Re-request on stall failed:', err);
      this.reportError(101, err, this.currentVideoId);
    }
  }

  handleAudioError(e) {
    const isUnsupported =
      this.audio?.error?.code === 4 ||
      e?.name === 'NotSupportedError' ||
      e?.message?.includes('no supported source');

    if (!isUnsupported && !this.hasRetried && this.currentVideoId) {
      this.handleStreamStall();
      return;
    }

    this.reportError(100, e, this.currentVideoId);
  }

  destroy() {
    this.loadToken++;
    this.loadPromise = null;
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
