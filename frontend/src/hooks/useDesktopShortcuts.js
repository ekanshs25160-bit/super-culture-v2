import { useEffect, useContext, useRef } from 'react';
import { AudioContext } from '../context/AudioContext';
import { handleKeyboardShortcut } from '../utils/keyboardShortcuts.js';

export function useDesktopShortcuts() {
  const {
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
    currentTime,
    duration,
    volume,
    setVolumeLevel,
    toggleShuffle,
    toggleRepeat,
    showToast,
  } = useContext(AudioContext);

  const stateRef = useRef({
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
    currentTime,
    duration,
    volume,
    setVolumeLevel,
    toggleShuffle,
    toggleRepeat,
    showToast,
  });

  const lastVolumeRef = useRef(volume > 0 ? volume : 0.74);

  useEffect(() => {
    stateRef.current = {
      togglePlay,
      skipNext,
      skipPrev,
      seekTo,
      currentTime,
      duration,
      volume,
      setVolumeLevel,
      toggleShuffle,
      toggleRepeat,
      showToast,
    };
    if (volume > 0) {
      lastVolumeRef.current = volume;
    }
  }, [
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
    currentTime,
    duration,
    volume,
    setVolumeLevel,
    toggleShuffle,
    toggleRepeat,
    showToast,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e) => {
      handleKeyboardShortcut(e, stateRef.current, lastVolumeRef);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}

export default useDesktopShortcuts;
