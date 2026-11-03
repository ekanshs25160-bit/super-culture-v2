import { PlayerState } from './PlayerConstants.js';
import { apiClient } from '../services/api.js';

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
    this.hasRetried = false;
    this.volume = 0.74;

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

  /**
   * Loads and plays audio for a YouTube videoId using the secure backend stream URL
   */
  async loadVideoById({ videoId, startSeconds = 0 }) {
    if (!videoId) return;

    this.currentVideoId = videoId;
    this.hasRetried = false;
    this.state = PlayerState.BUFFERING;
    this.emit('onBuffering');
    this.emit('onStateChange', PlayerState.BUFFERING);

    this.initAudioElement();

    try {
      const { url } = await apiClient.music.getStreamUrl(videoId, 'aac');
      this.currentSrc = url;

      if (this.audio) {
        this.audio.src = url;
        if (startSeconds > 0) {
          this.audio.currentTime = startSeconds;
        }
        await this.playVideo();
      }
    } catch (err) {
      console.error('[AudioElementPlayer] Failed to load stream URL:', err);
      this.handleAudioError(err);
    }
  }

  cueVideoById({ videoId, startSeconds = 0 }) {
    this.currentVideoId = videoId;
    this.hasRetried = false;
    this.state = PlayerState.CUED;
    this.emit('onStateChange', PlayerState.CUED);

    this.initAudioElement();
    apiClient.music
      .getStreamUrl(videoId, 'aac')
      .then(({ url }) => {
        this.currentSrc = url;
        if (this.audio) {
          this.audio.src = url;
          if (startSeconds > 0) {
            this.audio.currentTime = startSeconds;
          }
        }
      })
      .catch((err) => {
        console.warn('[AudioElementPlayer] Failed to cue stream URL:', err);
      });
  }

  async playVideo() {
    if (!this.audio) return;

    try {
      await this.audio.play();
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        console.warn('[AudioElementPlayer] Autoplay blocked by user-gesture policy.');
        this.emit('onAutoplayBlocked');
      } else {
        console.warn('[AudioElementPlayer] playVideo error:', err);
      }
    }
  }

  pauseVideo() {
    if (this.audio) {
      this.audio.pause();
    }
  }

  stopVideo() {
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
      const { url } = await apiClient.music.getStreamUrl(nextTrack.videoId, 'aac');
      if (this.preloadAudio) {
        this.preloadAudio.src = url;
        this.preloadAudio.preload = 'auto';
        this.preloadAudio.load();
      }
    } catch (err) {
      // Non-critical background failure
      console.debug('[AudioElementPlayer] Preload next track skipped:', err.message);
    }
  }

  /**
   * Recover from stream stalls or token expiry by re-requesting stream URL once
   */
  async handleStreamStall() {
    if (this.hasRetried || !this.currentVideoId) return;
    this.hasRetried = true;

    const resumeTime = this.getCurrentTime();
    console.log(`[AudioElementPlayer] Stream stalled. Refreshing signed URL for ${this.currentVideoId} at ${resumeTime}s...`);

    try {
      const { url } = await apiClient.music.getStreamUrl(this.currentVideoId, 'aac');
      this.currentSrc = url;
      if (this.audio) {
        this.audio.src = url;
        this.audio.currentTime = resumeTime;
        await this.playVideo();
      }
    } catch (err) {
      console.warn('[AudioElementPlayer] Re-request on stall failed:', err);
      this.emit('onError', 101, err);
    }
  }

  handleAudioError(e) {
    if (!this.hasRetried && this.currentVideoId) {
      this.handleStreamStall();
      return;
    }

    this.state = PlayerState.UNSTARTED;
    this.emit('onError', 100, e);
  }

  destroy() {
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
