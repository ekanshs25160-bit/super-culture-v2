import { PlayerState } from './PlayerConstants.js';

/**
 * Shared playback event handler used by both AudioElementPlayer and YouTubePlayer
 */
export const createPlaybackEventHandler = ({
  getIsRepeat,
  getSkipNext,
  getSkipTrack,
  setIsPlaying,
  showToast,
  onEngineFallback,
}) => {
  let consecutiveErrors = 0;
  let currentVideoId = null;

  return {
    setTrack: (videoId) => {
      if (currentVideoId !== videoId) {
        currentVideoId = videoId;
        consecutiveErrors = 0;
      }
    },

    handleStateChange: (state, playerInstance) => {
      if (state === PlayerState.ENDED) {
        if (getIsRepeat && getIsRepeat()) {
          if (playerInstance && typeof playerInstance.seekTo === 'function') {
            playerInstance.seekTo(0);
          }
          if (playerInstance && typeof playerInstance.playVideo === 'function') {
            playerInstance.playVideo();
          }
        } else {
          const skipNext = getSkipNext();
          if (skipNext) skipNext();
        }
        return;
      }

      if (state === PlayerState.PLAYING) {
        setIsPlaying(true);
        consecutiveErrors = 0; // reset error count on successful playback
      } else if (state === PlayerState.PAUSED) {
        setIsPlaying(false);
      } else if (state === PlayerState.BUFFERING) {
        // Keep active playing state during buffering
      } else if (state === PlayerState.CUED) {
        setIsPlaying(false);
      }
    },

    handleError: (errorCode, detail = '') => {
      consecutiveErrors += 1;
      console.warn(`[PlaybackEventHandler] Playback error (${errorCode}, attempts: ${consecutiveErrors}):`, detail);

      // If audio engine fails on this track, fall back to YouTube engine for this track
      if (onEngineFallback) {
        showToast?.('Audio stream failed • Switching to YouTube player');
        onEngineFallback();
        return;
      }

      // Codes 100 (not found/private), 101/150 (embedding restricted by owner), or network errors
      showToast?.('Track unavailable or restricted • Skipping to next...');
      const skipTrack = getSkipTrack();
      const skipNext = getSkipNext();
      if (skipTrack) {
        skipTrack(1);
      } else if (skipNext) {
        skipNext();
      }
    },
  };
};
