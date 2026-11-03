import { useEffect, useState, useRef, memo, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';
import { useUiStore } from '../store/useUiStore';
import { AudioElementPlayer } from '../engine/AudioElementPlayer';
import { resolveEffectiveEngine } from '../engine/PlayerConstants';
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

  // Setup shared event handler
  useEffect(() => {
    handlerRef.current = createPlaybackEventHandler({
      getIsRepeat: () => isRepeat,
      getSkipNext: () => skipNext,
      getSkipTrack: () => skipTrack,
      setIsPlaying,
      showToast,
      onEngineFallback: () => {
        setTemporaryEngineOverride('youtube');
      },
    });
  }, [isRepeat, skipNext, skipTrack, setIsPlaying, showToast, setTemporaryEngineOverride]);

  // Sync track ID with error count tracking
  useEffect(() => {
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
          handlerRef.current.handleError(code, detail);
        }
      });

      player.on('onAutoplayBlocked', () => {
        setAutoplayBlocked(true);
      });

      player.on('onPlaying', () => {
        setAutoplayBlocked(false);

        // Preload next track for near-gapless playback
        const currentIndex = queue.findIndex(
          (t) => (currentTrack?.videoId && t.videoId === currentTrack.videoId) || t.id === currentTrack?.id
        );
        if (currentIndex !== -1 && queue.length > 1) {
          const nextTrack = queue[(currentIndex + 1) % queue.length];
          player.preloadNextTrack(nextTrack);
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
