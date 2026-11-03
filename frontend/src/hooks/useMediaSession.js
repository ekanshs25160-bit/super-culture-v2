import { useEffect, useContext, useRef } from 'react';
import { AudioContext } from '../context/AudioContext';

/**
 * useMediaSession Hook
 * Integrates native OS lock-screen, notification shade, and Bluetooth transport controls
 * via the browser MediaSession API, working symmetrically with both HTMLAudio and YouTube engines.
 */
export function useMediaSession() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
  } = useContext(AudioContext);

  const actionsRef = useRef({
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
    currentTime,
    duration,
    isPlaying,
  });

  useEffect(() => {
    actionsRef.current = {
      togglePlay,
      skipNext,
      skipPrev,
      seekTo,
      currentTime,
      duration,
      isPlaying,
    };
  }, [togglePlay, skipNext, skipPrev, seekTo, currentTime, duration, isPlaying]);

  // Set MediaMetadata on track change
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !currentTrack) {
      return;
    }

    const cover =
      currentTrack.cover ||
      currentTrack.albumArt ||
      currentTrack.thumbnailUrl ||
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop';

    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title || 'Super Culture',
        artist: currentTrack.artist || 'Super Culture Radio',
        album: currentTrack.album || 'Super Culture Stream',
        artwork: [
          { src: cover, sizes: '96x96', type: 'image/jpeg' },
          { src: cover, sizes: '256x256', type: 'image/jpeg' },
          { src: cover, sizes: '512x512', type: 'image/jpeg' },
        ],
      });
    } catch (e) {
      console.warn('[useMediaSession] Could not set metadata:', e);
    }
  }, [currentTrack]);

  // Register MediaSession action handlers (play, pause, next, prev, seek, stop)
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    const actionHandlers = [
      ['play', () => {
        if (!actionsRef.current.isPlaying) {
          actionsRef.current.togglePlay();
        }
      }],
      ['pause', () => {
        if (actionsRef.current.isPlaying) {
          actionsRef.current.togglePlay();
        }
      }],
      ['previoustrack', () => {
        actionsRef.current.skipPrev();
      }],
      ['nexttrack', () => {
        actionsRef.current.skipNext();
      }],
      ['seekto', (details) => {
        if (details.seekTime != null) {
          actionsRef.current.seekTo(details.seekTime);
        }
      }],
      ['seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        actionsRef.current.seekTo(Math.max(0, actionsRef.current.currentTime - offset));
      }],
      ['seekforward', (details) => {
        const offset = details.seekOffset || 10;
        actionsRef.current.seekTo(
          Math.min(actionsRef.current.duration || 300, actionsRef.current.currentTime + offset)
        );
      }],
      ['stop', () => {
        if (actionsRef.current.isPlaying) {
          actionsRef.current.togglePlay();
        }
      }],
    ];

    actionHandlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (err) {
        console.debug(`[useMediaSession] Action ${action} not supported:`, err.message);
      }
    });

    return () => {
      actionHandlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore cleanup errors
        }
      });
    };
  }, []);

  // Update playback state and position state about once per second
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    if (
      typeof navigator.mediaSession.setPositionState === 'function' &&
      duration > 0 &&
      !isNaN(duration) &&
      !isNaN(currentTime)
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, duration),
          playbackRate: 1,
          position: Math.max(0, Math.min(currentTime, duration)),
        });
      } catch {
        // May fail if position > duration during track transitions
      }
    }
  }, [isPlaying, currentTime, duration]);
}

export default useMediaSession;
