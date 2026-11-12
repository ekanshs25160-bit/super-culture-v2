/**
 * Desktop Keyboard Shortcuts Utility
 * Handles keyboard navigation, playback controls, and input target exclusion.
 */

export function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName ? target.tagName.toUpperCase() : '';
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  return Boolean(target.closest?.('input, textarea, select, [contenteditable="true"]'));
}

/**
 * Dispatches action for a keyboard event.
 * @param {KeyboardEvent} e
 * @param {Object} state - { togglePlay, skipNext, skipPrev, seekTo, currentTime, duration, volume, setVolumeLevel, toggleShuffle, toggleRepeat, showToast }
 * @param {Object} lastVolumeRef - { current: number }
 * @returns {string|null} - Action executed or null
 */
export function handleKeyboardShortcut(e, state, lastVolumeRef = { current: 0.74 }) {
  if (!e || isEditableTarget(e.target)) return null;

  const { code, key, shiftKey, ctrlKey, metaKey, altKey } = e;
  if (ctrlKey || metaKey || altKey) return null;

  // 1. Space: Play / Pause
  if (code === 'Space' || key === ' ') {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof state.togglePlay === 'function') state.togglePlay();
    return 'togglePlay';
  }

  // 2. Next track: KeyN or Shift+ArrowRight
  if (
    code === 'KeyN' ||
    key === 'n' ||
    key === 'N' ||
    (shiftKey && (code === 'ArrowRight' || key === 'ArrowRight'))
  ) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof state.skipNext === 'function') state.skipNext();
    return 'skipNext';
  }

  // 3. Previous track: KeyP or Shift+ArrowLeft
  if (
    code === 'KeyP' ||
    key === 'p' ||
    key === 'P' ||
    (shiftKey && (code === 'ArrowLeft' || key === 'ArrowLeft'))
  ) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof state.skipPrev === 'function') state.skipPrev();
    return 'skipPrev';
  }

  // 4. Seek +5s: ArrowRight (without Shift)
  if (!shiftKey && (code === 'ArrowRight' || key === 'ArrowRight')) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    const target = Math.min(state.duration || 300, (state.currentTime || 0) + 5);
    if (typeof state.seekTo === 'function') state.seekTo(target);
    return 'seekForward';
  }

  // 5. Seek -5s: ArrowLeft (without Shift)
  if (!shiftKey && (code === 'ArrowLeft' || key === 'ArrowLeft')) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    const target = Math.max(0, (state.currentTime || 0) - 5);
    if (typeof state.seekTo === 'function') state.seekTo(target);
    return 'seekBackward';
  }

  // 6. Toggle Shuffle: KeyS
  if (!shiftKey && (code === 'KeyS' || key === 's' || key === 'S')) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof state.toggleShuffle === 'function') state.toggleShuffle();
    return 'toggleShuffle';
  }

  // 7. Cycle Repeat: KeyR
  if (!shiftKey && (code === 'KeyR' || key === 'r' || key === 'R')) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof state.toggleRepeat === 'function') state.toggleRepeat();
    return 'toggleRepeat';
  }

  // 8. Toggle Mute: KeyM
  if (!shiftKey && (code === 'KeyM' || key === 'm' || key === 'M')) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (state.volume > 0) {
      lastVolumeRef.current = state.volume;
      if (typeof state.setVolumeLevel === 'function') state.setVolumeLevel(0);
      if (typeof state.showToast === 'function') state.showToast('Audio muted');
      return 'mute';
    } else {
      const restore = lastVolumeRef.current > 0 ? lastVolumeRef.current : 0.74;
      if (typeof state.setVolumeLevel === 'function') state.setVolumeLevel(restore);
      if (typeof state.showToast === 'function') {
        state.showToast(`Audio unmuted (${Math.round(restore * 100)}%)`);
      }
      return 'unmute';
    }
  }

  return null;
}
