/**
 * Player state constants compatible with YouTube IFrame PlayerState numbers
 */
export const PlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

/**
 * Supported playback engines
 */
export const PlaybackEngine = {
  AUTO: 'Auto',
  AUDIO: 'Audio stream',
  YOUTUBE: 'YouTube player',
};

/**
 * Determines whether the active engine should be HTMLAudioElement or YouTube IFrame.
 */
export const resolveEffectiveEngine = (preference) => {
  if (preference === PlaybackEngine.AUDIO) return 'audio';
  if (preference === PlaybackEngine.YOUTUBE) return 'youtube';

  // Auto mode: use native audio on mobile devices or narrow viewports
  if (typeof window !== 'undefined') {
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    const isNarrowViewport = window.innerWidth < 1024;
    if (isMobileUA || isNarrowViewport) {
      return 'audio';
    }
  }

  return 'youtube';
};
