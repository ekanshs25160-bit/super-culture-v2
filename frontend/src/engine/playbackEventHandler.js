import { PlayerState } from './PlayerConstants.js';

/**
 * Global circuit breaker error counter and play start timestamp outside the component/hook lifecycle.
 * Persists across track skips and re-renders to prevent infinite skip loops.
 */
let consecutiveErrors = 0;
let currentTrackPlayStart = null;

/**
 * Tracks video IDs that have already been retried once to prevent repeated retries on the same track.
 */
const retriedTracks = new Set();

export const getConsecutiveErrors = () => consecutiveErrors;
export const getCurrentTrackPlayStart = () => currentTrackPlayStart;
export const setCurrentTrackPlayStartForTesting = (val) => {
  currentTrackPlayStart = val;
};
export const resetConsecutiveErrors = () => {
  consecutiveErrors = 0;
  currentTrackPlayStart = null;
  retriedTracks.clear();
};

/**
 * Shared playback event handler used by both AudioElementPlayer and YouTubePlayer
 */
export const createPlaybackEventHandler = ({
  getIsRepeat,
  getRepeatMode,
  getSkipNext,
  getSkipTrack,
  onTrackEnded,
  setIsPlaying,
  showToast,
  onEngineFallback,
  pauseVideo,
  retryStream,
  onUnrecoverable,
} = {}) => {
  let currentVideoId = null;
  let lastPlayerInstance = null;

  const onPlaying = () => {
    currentTrackPlayStart = Date.now();
    setIsPlaying?.(true);
  };

  const onPaused = () => {
    currentTrackPlayStart = null;
    setIsPlaying?.(false);
  };

  const handleAudioError = (e, playerInstance) => {
    currentTrackPlayStart = null;
    consecutiveErrors += 1;
    console.warn(`[PlaybackEventHandler] handleAudioError (consecutive: ${consecutiveErrors}):`, e);

    const player = playerInstance || lastPlayerInstance;

    // Circuit Breaker: >= 3 consecutive failures halts playback to prevent infinite loop
    if (consecutiveErrors >= 3) {
      console.warn('[PlaybackEventHandler] Circuit breaker triggered: >= 3 consecutive errors. Halting playback.');
      if (typeof pauseVideo === 'function') {
        pauseVideo();
      } else if (player && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
      }
      showToast?.('Streaming unavailable right now. Try again later.');
      setIsPlaying?.(false);
      return; // DO NOT call skipNext()
    }

    const triggerDelayedSkip = () => {
      // Give the host a chance to hand the track to another engine (e.g. YouTube IFrame)
      // before giving up on it and skipping.
      if (typeof onUnrecoverable === 'function') {
        let handled = false;
        try {
          handled = onUnrecoverable({ videoId: currentVideoId, error: e, player }) === true;
        } catch (fallbackErr) {
          console.warn('[PlaybackEventHandler] onUnrecoverable failed:', fallbackErr);
        }
        if (handled) {
          // A different engine now owns this track; don't let this failure trip the circuit breaker.
          consecutiveErrors = 0;
          return;
        }
      }
      showToast?.('Track unavailable or restricted • Skipping to next...');
      setTimeout(() => {
        const skipNext = getSkipNext?.();
        const skipTrack = getSkipTrack?.();
        if (typeof skipNext === 'function') {
          skipNext(1);
        } else if (typeof skipTrack === 'function') {
          skipTrack(1);
        }
      }, 500);
    };

    // If < 3, retry the stream once (unless the player already exhausted its internal URL refresh).
    // If the retry fails, call triggerDelayedSkip() (which invokes onUnrecoverable first).
    const canRetry = currentVideoId && !retriedTracks.has(currentVideoId) && !player?.hasRetried;
    if (canRetry) {
      retriedTracks.add(currentVideoId);

      let retryPromise = null;
      if (player && typeof player.handleStreamStall === 'function') {
        retryPromise = player.handleStreamStall();
      } else if (typeof retryStream === 'function') {
        retryPromise = retryStream();
      } else if (onEngineFallback) {
        try {
          onEngineFallback(e?.code || 100, e?.detail || e?.message || e);
          return;
        } catch (fallbackErr) {
          console.warn('[PlaybackEventHandler] onEngineFallback failed:', fallbackErr);
        }
      }

      if (retryPromise && typeof retryPromise.then === 'function') {
        retryPromise
          .then((recovered) => {
            if (recovered === false) {
              triggerDelayedSkip();
            }
          })
          .catch((retryErr) => {
            console.warn('[PlaybackEventHandler] Retry stream failed:', retryErr);
            triggerDelayedSkip();
          });
        return;
      }
    }

    triggerDelayedSkip();
  };

  const handleTimeUpdate = () => {
    // ONLY reset consecutiveErrors = 0 if the current track has actively played for >= 3000ms
    if (currentTrackPlayStart !== null && Date.now() - currentTrackPlayStart >= 3000) {
      if (consecutiveErrors > 0) {
        console.log('[PlaybackEventHandler] Track played continuously for >= 3000ms. Resetting consecutiveErrors.');
      }
      consecutiveErrors = 0;
      retriedTracks.clear();
    }
  };

  return {
    setTrack: (videoId) => {
      currentTrackPlayStart = null;
      if (currentVideoId !== videoId) {
        currentVideoId = videoId;
        // NOTE: consecutiveErrors is NOT reset on track change per circuit breaker requirements
      }
    },

    onPlaying,
    handlePlaying: onPlaying,

    onPaused,
    handlePaused: onPaused,

    handleStateChange: (state, playerInstance) => {
      if (playerInstance) {
        lastPlayerInstance = playerInstance;
      }

      if (state === PlayerState.ENDED) {
        currentTrackPlayStart = null;
        if (typeof onTrackEnded === 'function') {
          onTrackEnded(playerInstance);
          return;
        }
        const repMode = getRepeatMode ? getRepeatMode() : (getIsRepeat && getIsRepeat() ? 'one' : 'off');
        if (repMode === 'one') {
          if (playerInstance && typeof playerInstance.seekTo === 'function') {
            playerInstance.seekTo(0);
          }
          if (playerInstance && typeof playerInstance.playVideo === 'function') {
            playerInstance.playVideo();
          }
        } else {
          const skipNext = getSkipNext?.();
          if (skipNext) skipNext();
        }
        return;
      }

      if (state === PlayerState.PLAYING) {
        onPlaying();
      } else if (state === PlayerState.PAUSED) {
        onPaused();
      } else if (state === PlayerState.BUFFERING) {
        // Keep active playing state during buffering
      } else if (state === PlayerState.CUED) {
        currentTrackPlayStart = null;
        setIsPlaying?.(false);
      }
    },

    onError: handleAudioError,
    handleAudioError,
    handleError: (errorCode, detail = '', playerInstance) => {
      return handleAudioError({ code: errorCode, detail }, playerInstance);
    },

    handleTimeUpdate,
    onTimeUpdate: handleTimeUpdate,
  };
};

export default createPlaybackEventHandler;
