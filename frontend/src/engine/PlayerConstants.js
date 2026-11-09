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

const envAudioEngineEnabled =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_AUDIO_ENGINE_ENABLED === 'true' ||
      import.meta.env.AUDIO_ENGINE_ENABLED === 'true')) ||
  (typeof globalThis !== 'undefined' &&
    globalThis.process?.env &&
    (globalThis.process.env.VITE_AUDIO_ENGINE_ENABLED === 'true' ||
      globalThis.process.env.AUDIO_ENGINE_ENABLED === 'true')) ||
  false;

/**
 * Feature flag controlling whether the <audio> proxy engine is enabled.
 * Defaults to false so every device uses the YouTube IFrame until Part B PO-token unthrottling is enabled.
 */
export let AUDIO_ENGINE_ENABLED = Boolean(envAudioEngineEnabled);

export const setAudioEngineEnabled = (enabled) => {
  AUDIO_ENGINE_ENABLED = Boolean(enabled);
};

export const isAudioEngineEnabled = () => {
  if (typeof globalThis !== 'undefined' && typeof globalThis.AUDIO_ENGINE_ENABLED === 'boolean') {
    return globalThis.AUDIO_ENGINE_ENABLED;
  }
  return AUDIO_ENGINE_ENABLED;
};

/**
 * Separate viewport helper for responsive UI/CSS checks if needed (not used for engine selection).
 */
export const isMobileViewport = () => {
  return typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth < 1024;
};

/**
 * Detects true mobile/touch devices without using window.innerWidth < 1024.
 * Returns true only when:
 * 1. Mobile/tablet UA (or navigator.userAgentData.mobile)
 * 2. iPadOS (Macintosh + maxTouchPoints > 1)
 * 3. Touch-primary pointer (matchMedia('(pointer: coarse)')?.matches)
 * 4. Standalone installed PWA
 */
export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;

  // 1. Modern Chromium Client Hints API
  if (typeof navigator !== 'undefined' && navigator.userAgentData?.mobile) {
    return true;
  }

  // 2. Mobile or tablet User-Agent match
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|PlayBook|Silk/i.test(ua)) {
    return true;
  }

  // 3. iPadOS on iOS 13+ (reports as Macintosh with multi-touch points > 1)
  if (
    /Macintosh/i.test(ua) &&
    typeof navigator !== 'undefined' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1
  ) {
    return true;
  }

  // 4. Touch-primary input device
  if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)')?.matches) {
    return true;
  }

  // 5. Standalone display-mode (Installed PWA on home screen)
  if (
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)')?.matches) ||
    (typeof navigator !== 'undefined' && navigator.standalone === true)
  ) {
    return true;
  }

  return false;
};

export const isMobileOrTouchDevice = isMobileDevice;

/**
 * Determines whether the active engine should be HTMLAudioElement or YouTube IFrame.
 */
export const resolveEffectiveEngine = (preference, options = {}) => {
  const audioEnabled =
    typeof options?.audioEngineEnabled === 'boolean'
      ? options.audioEngineEnabled
      : isAudioEngineEnabled();

  if (!audioEnabled) {
    return 'youtube';
  }

  if (preference === PlaybackEngine.AUDIO || preference === 'audio' || preference === 'Audio stream') {
    return 'audio';
  }
  if (preference === PlaybackEngine.YOUTUBE || preference === 'youtube' || preference === 'YouTube player') {
    return 'youtube';
  }

  // Auto mode: use native audio only on true mobile/touch/PWA devices
  if (isMobileDevice()) {
    return 'audio';
  }

  return 'youtube';
};
