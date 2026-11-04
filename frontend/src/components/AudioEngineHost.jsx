import { useEffect, useState, useRef, memo, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';
import { useUiStore } from '../store/useUiStore';
import { AudioElementPlayer } from '../engine/AudioElementPlayer';
import { resolveEffectiveEngine, isMobileDevice } from '../engine/PlayerConstants';
import { createPlaybackEventHandler } from '../engine/playbackEventHandler';
import YouTubePlayer from './YouTubePlayer';

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

  // Sync active engine to UI store for diagnostics display in Settings
  useEffect(() => {
    setActiveEngine(effectiveEngine);
  }, [effectiveEngine, setActiveEngine]);

  // Setup shared event handler
  useEffect(() => {
    handlerRef.current = createPlaybackEventHandler({
      getIsRepeat: () => isRepeat,
      getSkipNext: () => skipNext,
      getSkipTrack: () => skipTrack,
      setIsPlaying,
      showToast,
      pauseVideo: () => audioPlayerRef.current?.pauseVideo(),
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
  }, [isRepeat, skipNext, skipTrack, setIsPlaying, showToast, setTemporaryEngineOverride, setLastFallbackReason, currentTrack]);

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
      const player = new AudioElementPlayer();
      audioPlayerRef.current = player;

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
