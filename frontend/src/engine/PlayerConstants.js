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
 * Robust detection of mobile environment across UA strings, UserAgentData, iPads, PWAs, and viewport widths
 */
export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;

  // 1. Modern Chromium Client Hints API
  if (typeof navigator !== 'undefined' && navigator.userAgentData?.mobile) {
    return true;
  }

  // 2. Standard mobile User Agent match
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  // 3. iPad on iOS 13+ (reports as Macintosh with multi-touch points)
  if (
    /Macintosh/i.test(ua) &&
    typeof navigator !== 'undefined' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1
  ) {
    return true;
  }

  // 4. Standalone display-mode (Installed PWA on home screen)
  if (
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    (typeof navigator !== 'undefined' && navigator.standalone === true)
  ) {
    return true;
  }

  // 5. Narrow responsive viewport (< 1024px)
  if (typeof window.innerWidth === 'number' && window.innerWidth < 1024) {
    return true;
  }

  return false;
};

/**
 * Determines whether the active engine should be HTMLAudioElement or YouTube IFrame.
 */
export const resolveEffectiveEngine = (preference) => {
  if (preference === PlaybackEngine.AUDIO || preference === 'audio' || preference === 'Audio stream') {
    return 'audio';
  }
  if (preference === PlaybackEngine.YOUTUBE || preference === 'youtube' || preference === 'YouTube player') {
    return 'youtube';
  }

  // Auto mode: use native audio on mobile devices or narrow viewports
  if (isMobileDevice()) {
    return 'audio';
  }

  return 'youtube';
};
