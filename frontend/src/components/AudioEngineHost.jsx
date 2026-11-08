import { useEffect, useState, useRef, memo, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';
import { useUiStore } from '../store/useUiStore';
import { AudioElementPlayer } from '../engine/AudioElementPlayer';
import { resolveEffectiveEngine, isMobileDevice } from '../engine/PlayerConstants';
import { createPlaybackEventHandler } from '../engine/playbackEventHandler';
import YouTubePlayer from './YouTubePlayer';

export const COMPAT_MODE_NOTICE = 'Compatibility mode: lock-screen and background playback are unavailable for this track.';

const AudioEngineHost = memo(function AudioEngineHost() {
  const {
    currentTrack,
    queue,
    currentTime,
    setPlayerRef,
    skipTrack,
    skipNext,
    setPlayerReady,
    volume,
    setIsPlaying,
    isRepeat,
    showToast,
  } = useContext(AudioContext);

  const {
    playbackEngine,
    temporaryEngineOverride,
    setTemporaryEngineOverride,
    setAutoplayBlocked,
    setActiveEngine,
    setLastFallbackReason,
    compatFallback,
    setCompatFallback,
    clearCompatFallback,
  } = useUiStore();

  const [, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const effectiveEngine = temporaryEngineOverride || resolveEffectiveEngine(playbackEngine);
  const audioPlayerRef = useRef(null);
  const handlerRef = useRef(null);
  const mobileRetriedRef = useRef(false);
  // Last playback position reported by the audio element, kept per video so it survives element resets on error
  const lastTimeRef = useRef({ videoId: null, seconds: 0 });
  const triggerFallbackRef = useRef(null);

  triggerFallbackRef.current = ({ videoId, seconds, reason }) => {
    if (!videoId) return false;
    const player = audioPlayerRef.current;
    const playerTime = player?.getCurrentTime?.() || 0;
    const tracked = lastTimeRef.current;
    const trackedTime = tracked.videoId === videoId && tracked.seconds > 0 ? tracked.seconds : 0;
    const finalSeconds =
      typeof seconds === 'number'
        ? seconds
        : playerTime > 0
        ? playerTime
        : trackedTime > 0
        ? trackedTime
        : currentTime || 0;

    player?.pauseVideo();
    setCompatFallback({ videoId, seconds: finalSeconds });
    const fallbackReason =
      reason ||
      (finalSeconds > 0
        ? `Audio stream failed at ${Math.floor(finalSeconds)}s • Compatibility mode (YouTube)`
        : 'Stream throttled by YouTube • Compatibility mode (YouTube)');
    setLastFallbackReason(fallbackReason);
    showToast?.(COMPAT_MODE_NOTICE);
    setTemporaryEngineOverride('youtube');
    return true;
  };

  // Sync active engine to UI store for diagnostics display in Settings
  useEffect(() => {
    setActiveEngine(effectiveEngine);
  }, [effectiveEngine, setActiveEngine]);

  // One-time global interaction unlock listener for mobile WebViews / Mobile Safari
  useEffect(() => {
    const handleFirstInteraction = () => {
      audioPlayerRef.current?.unlock();
    };
    window.addEventListener('touchstart', handleFirstInteraction, { once: true, passive: true });
    window.addEventListener('touchend', handleFirstInteraction, { once: true, passive: true });
    window.addEventListener('click', handleFirstInteraction, { once: true });
    return () => {
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('touchend', handleFirstInteraction);
      window.removeEventListener('click', handleFirstInteraction);
    };
  }, []);

  // Setup shared event handler
  useEffect(() => {
    handlerRef.current = createPlaybackEventHandler({
      getIsRepeat: () => isRepeat,
      getSkipNext: () => skipNext,
      getSkipTrack: () => skipTrack,
      setIsPlaying,
      showToast,
      pauseVideo: () => audioPlayerRef.current?.pauseVideo(),
      // Unrecoverable <audio> failure (502 on load, 403 / stall mid-track, or throttled upstream):
      // hand the same track to the YouTube IFrame at the specified offset instead of skipping it.
      onUnrecoverable: (payload) => {
        return triggerFallbackRef.current?.(payload);
      },
      onEngineFallback: (errorCode, detail) => {
        const isMobile = isMobileDevice();
        if (isMobile) {
          // On mobile, never fall back to YouTube iframe (background playback stops in iframe)
          if (!mobileRetriedRef.current && audioPlayerRef.current && currentTrack?.videoId) {
            mobileRetriedRef.current = true;
            console.log('[AudioEngineHost] Mobile audio error: retrying audio stream once...');
            audioPlayerRef.current.handleStreamStall();
            return;
          }

          const reason = `Mobile stream failure (code ${errorCode}${detail ? `: ${detail}` : ''}) • Skipped track`;
          setLastFallbackReason(reason);
          showToast?.('Audio playback failed • Skipping to next track');
          const skip = skipNext || (() => skipTrack(1));
          skip();
        } else {
          // On desktop, fallback to YouTube iframe
          const reason = `Desktop stream failure (code ${errorCode}${detail ? `: ${detail}` : ''}) • Fallback to YouTube`;
          setLastFallbackReason(reason);
          showToast?.('Audio stream failed • Switching to YouTube player');
          setTemporaryEngineOverride('youtube');
        }
      },
    });
  }, [isRepeat, skipNext, skipTrack, setIsPlaying, showToast, currentTrack]);

  // Compatibility mode is per track: once the queue moves on, try the audio stream again
  useEffect(() => {
    if (compatFallback && currentTrack?.videoId && currentTrack.videoId !== compatFallback.videoId) {
      clearCompatFallback();
    }
  }, [compatFallback, currentTrack, clearCompatFallback]);

  // Sync track ID with error count tracking and reset retry flag
  useEffect(() => {
    mobileRetriedRef.current = false;
    if (currentTrack?.videoId && handlerRef.current) {
      handlerRef.current.setTrack(currentTrack.videoId);
    }
  }, [currentTrack]);

  // AudioElement engine lifecycle
  useEffect(() => {
    if (effectiveEngine !== 'audio') {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pauseVideo();
      }
      return;
    }

    if (!audioPlayerRef.current) {
      const player = new AudioElementPlayer({
        onUnrecoverable: (payload) => triggerFallbackRef.current?.(payload),
      });
      audioPlayerRef.current = player;

      player.on('onThrottled', (payload) => {
        triggerFallbackRef.current?.(payload);
      });

      player.on('onUnrecoverable', (payload) => {
        triggerFallbackRef.current?.(payload);
      });

      player.on('onStateChange', (state) => {
        if (handlerRef.current) {
          handlerRef.current.handleStateChange(state, player);
        }
      });

      player.on('onError', (code, detail) => {
        if (handlerRef.current) {
          handlerRef.current.handleError(code, detail, player);
        }
      });

      player.on('onTimeUpdate', (currentTime) => {
        if (player.currentVideoId && currentTime > 0) {
          lastTimeRef.current = { videoId: player.currentVideoId, seconds: currentTime };
        }
        if (handlerRef.current) {
          handlerRef.current.handleTimeUpdate?.(currentTime);
        }
      });

      player.on('onAutoplayBlocked', () => {
        setAutoplayBlocked(true);
      });

      player.on('onPlaying', () => {
        setAutoplayBlocked(false);
        if (handlerRef.current) {
          handlerRef.current.onPlaying?.();
        }

        // Preload next track for near-gapless playback
        const currentIndex = queue.findIndex(
          (t) => (currentTrack?.videoId && t.videoId === currentTrack.videoId) || t.id === currentTrack?.id
        );
        if (currentIndex !== -1 && queue.length > 1) {
          const nextTrack = queue[(currentIndex + 1) % queue.length];
          player.preloadNextTrack(nextTrack);
        }
      });

      player.on('onPaused', () => {
        if (handlerRef.current) {
          handlerRef.current.onPaused?.();
        }
      });

      setPlayerRef(player);
      setPlayerReady();
      player.setVolume(Math.round((volume || 0.74) * 100));

      if (currentTrack?.videoId) {
        player.cueVideoById({
          videoId: currentTrack.videoId,
          startSeconds: currentTime || 0,
        });
      }
    } else {
      setPlayerRef(audioPlayerRef.current);
    }

    return () => {
      // Retain instance across renders; cleanup on unmount handled in player
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveEngine, setPlayerRef, setPlayerReady, setAutoplayBlocked, volume, queue, currentTrack]);

  // If using YouTube engine, render headless iframe component
  if (effectiveEngine === 'youtube') {
    return <YouTubePlayer />;
  }

  return null;
});

export default AudioEngineHost;
