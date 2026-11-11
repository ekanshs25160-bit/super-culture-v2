import { useEffect, useContext, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { AudioContext } from '../context/AudioContext';
import { StreamProxy } from '../services/nativeYtClient';

/**
 * useMediaSession Hook
 * Integrates native OS lock-screen, notification shade, and Bluetooth transport controls
 * via both the browser MediaSession API and the Android Foreground MediaPlaybackService plugin.
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

  const lastNativeStateRef = useRef({
    isPlaying: null,
    position: -10,
    duration: 0,
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

  // 1. Set MediaMetadata on track change (Web MediaSession + Native Android MediaPlaybackService)
  useEffect(() => {
    if (!currentTrack) return;

    const cover =
      currentTrack.cover ||
      currentTrack.albumArt ||
      currentTrack.thumbnailUrl ||
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop';

    const title = currentTrack.title || 'Super Culture';
    const artist = currentTrack.artist || 'Super Culture Radio';
    const album = currentTrack.album || 'Super Culture Stream';
    const trackDuration = Number(currentTrack.seconds || currentTrack.duration || duration || 210) || 210;

    if (Capacitor.isNativePlatform()) {
      try {
        StreamProxy.updateMetadata({
          title,
          artist,
          album,
          artworkUrl: cover,
          duration: trackDuration,
        }).catch(() => {});
      } catch (err) {
        console.warn('[useMediaSession] Native updateMetadata failed:', err);
      }
    }

    if (typeof window !== 'undefined' && 'mediaSession' in navigator && window.MediaMetadata) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title,
          artist,
          album,
          artwork: [
            { src: cover, sizes: '96x96', type: 'image/jpeg' },
            { src: cover, sizes: '256x256', type: 'image/jpeg' },
            { src: cover, sizes: '512x512', type: 'image/jpeg' },
          ],
        });
      } catch (e) {
        console.warn('[useMediaSession] Could not set metadata:', e);
      }
    }
  }, [currentTrack, duration]);

  // 2. Register Native Android MediaSession callback listener
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || typeof StreamProxy?.addListener !== 'function') {
      return;
    }

    let listenerHandle = null;
    let unmounted = false;

    Promise.resolve(
      StreamProxy.addListener('mediaAction', (event = {}) => {
        const { action, seekTime } = event;
        switch (action) {
          case 'play':
            if (!actionsRef.current.isPlaying) {
              actionsRef.current.togglePlay();
            }
            break;
          case 'pause':
            if (actionsRef.current.isPlaying) {
              actionsRef.current.togglePlay();
            }
            break;
          case 'next':
          case 'nexttrack':
            actionsRef.current.skipNext();
            break;
          case 'previous':
          case 'previoustrack':
            actionsRef.current.skipPrev();
            break;
          case 'seekTo':
          case 'seekto':
            if (seekTime != null && !Number.isNaN(Number(seekTime))) {
              actionsRef.current.seekTo(Number(seekTime));
            }
            break;
          default:
            break;
        }
      })
    )
      .then((handle) => {
        if (unmounted) {
          handle?.remove?.();
        } else {
          listenerHandle = handle;
        }
      })
      .catch((err) => {
        console.warn('[useMediaSession] Could not attach mediaAction listener:', err);
      });

    return () => {
      unmounted = true;
      listenerHandle?.remove?.();
    };
  }, []);

  // 3. Register Web MediaSession action handlers (play, pause, next, prev, seek, stop)
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

  // 4. Update playback state and position state (Web + Native Android throttled to state changes & seeks)
  useEffect(() => {
    if (Capacitor.isNativePlatform() && currentTrack) {
      const pos = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
      const dur = Number.isFinite(duration) && duration > 0 ? duration : 210;
      const last = lastNativeStateRef.current;

      const stateChanged = last.isPlaying !== isPlaying || Math.abs(last.duration - dur) > 1;
      const positionJumped = Math.abs(pos - last.position) >= 4;

      if (stateChanged || positionJumped) {
        lastNativeStateRef.current = { isPlaying, position: pos, duration: dur };
        try {
          StreamProxy.updatePlaybackState({
            isPlaying: Boolean(isPlaying),
            position: pos,
            duration: dur,
          }).catch(() => {});
        } catch {
          // ignore native state sync errors
        }
      }
    }

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
  }, [currentTrack, isPlaying, currentTime, duration]);
}

export default useMediaSession;
