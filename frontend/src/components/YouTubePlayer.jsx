import { useEffect, useRef, memo, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';
import { useUiStore } from '../store/useUiStore';
import { createPlaybackEventHandler } from '../engine/playbackEventHandler';
import {
  hasValidVideoId,
  buildYtPlayerOptions,
  initOrSyncYouTubePlayer,
} from '../engine/youtubePlayerController';

const YouTubePlayer = memo(function YouTubePlayer() {
  const {
    currentTrack,
    currentTime,
    setPlayerRef,
    skipTrack,
    skipNext,
    setPlayerReady,
    volume,
    isPlaying,
    setIsPlaying,
    isRepeat,
    repeatMode,
    handleTrackEnded,
    showToast,
  } = useContext(AudioContext);

  const setAutoplayBlocked = useUiStore((s) => s.setAutoplayBlocked);

  const containerRef = useRef(null);
  const playerInstanceRef = useRef(null);
  const isInitializedRef = useRef(false);
  const isReadyRef = useRef(false);
  const initialVideoIdRef = useRef(currentTrack?.videoId);
  const initialTimeRef = useRef(currentTime);
  const latestTrackRef = useRef(currentTrack);
  latestTrackRef.current = currentTrack;
  // When the audio engine failed mid-track, resume from the offset it reached.
  const resumeFromFallback = (videoId) => {
    const fb = useUiStore.getState().compatFallback;
    return fb && fb.videoId === videoId && fb.seconds > 0 ? fb.seconds : null;
  };

  const handlerRef = useRef(null);
  const wasPlayingBeforeHiddenRef = useRef(false);

  // Background tab visibility persistence
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (isPlaying) {
          wasPlayingBeforeHiddenRef.current = true;
          // When switching tabs, YouTube iframe pauses; re-trigger play to keep background audio
          setTimeout(() => {
            if (wasPlayingBeforeHiddenRef.current && playerInstanceRef.current && typeof playerInstanceRef.current.playVideo === 'function') {
              try {
                playerInstanceRef.current.playVideo();
              } catch {
                // non-critical
              }
            }
          }, 150);
        }
      } else {
        if (wasPlayingBeforeHiddenRef.current) {
          wasPlayingBeforeHiddenRef.current = false;
          if (playerInstanceRef.current && typeof playerInstanceRef.current.playVideo === 'function') {
            try {
              playerInstanceRef.current.playVideo();
            } catch {
              // non-critical
            }
          }
          setIsPlaying(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying, setIsPlaying]);

  useEffect(() => {
    handlerRef.current = createPlaybackEventHandler({
      getIsRepeat: () => isRepeat,
      getRepeatMode: () => repeatMode,
      getSkipNext: () => skipNext,
      getSkipTrack: () => skipTrack,
      onTrackEnded: () => handleTrackEnded?.(),
      setIsPlaying,
      showToast,
    });
  }, [isRepeat, repeatMode, handleTrackEnded, skipNext, skipTrack, setIsPlaying, showToast]);

  // Sync track changes when YouTube player is active and ready
  useEffect(() => {
    if (currentTrack?.videoId && handlerRef.current) {
      handlerRef.current.setTrack(currentTrack.videoId);
    }

    if (isReadyRef.current && playerInstanceRef.current && hasValidVideoId(currentTrack?.videoId)) {
      try {
        const startSeconds = resumeFromFallback(currentTrack.videoId) || 0;
        playerInstanceRef.current.loadVideoById({
          videoId: currentTrack.videoId,
          startSeconds,
        });
        playerInstanceRef.current.playVideo();
      } catch (err) {
        console.warn('[YouTubePlayer] Error on track change:', err);
      }
    }
  }, [currentTrack]);

  useEffect(() => {
    if (isInitializedRef.current) return;
    const candidateVideoId = currentTrack?.videoId || initialVideoIdRef.current;
    if (!hasValidVideoId(candidateVideoId)) return;

    const loadAPI = () => {
      return new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
          resolve();
          return;
        }

        const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevReady) prevReady();
          resolve();
        };

        if (!existingScript) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(tag);
        }
      });
    };

    initOrSyncYouTubePlayer({
      currentTrack,
      initialVideoIdRef,
      isInitializedRef,
      isReadyRef,
      playerInstanceRef,
      containerRef,
      loadAPI,
      resumeFromFallback,
      createPlayer: (targetVideoId) =>
        new window.YT.Player(
          containerRef.current,
          buildYtPlayerOptions({
            videoId: targetVideoId,
            origin: window.location.origin,
            events: {
              onReady: (event) => {
                const activeVideoId = latestTrackRef.current?.videoId || targetVideoId;
                console.log('[YouTubePlayer] Lazy headless iframe player ready with video:', activeVideoId);
                isReadyRef.current = true;
                playerInstanceRef.current = event.target;
                setPlayerRef(event.target);
                setPlayerReady();
                event.target.setVolume(Math.round((volume || 0.74) * 100));

                if (hasValidVideoId(activeVideoId)) {
                  try {
                    const resumeAt = resumeFromFallback(activeVideoId) ?? initialTimeRef.current;
                    const loadedUrl = event.target.getVideoUrl?.() || '';
                    if (activeVideoId !== targetVideoId || !loadedUrl.includes(activeVideoId)) {
                      event.target.loadVideoById({
                        videoId: activeVideoId,
                        startSeconds: resumeAt && resumeAt > 0 ? resumeAt : 0,
                      });
                    } else if (resumeAt && resumeAt > 0) {
                      event.target.seekTo(resumeAt, true);
                    }
                    event.target.playVideo();
                  } catch (err) {
                    console.warn('[YouTubePlayer] playVideo error in onReady:', err);
                  }

                  // On mobile, if autoplay is restricted by the user agent, prompt with tap-to-play
                  setTimeout(() => {
                    if (playerInstanceRef.current && typeof playerInstanceRef.current.getPlayerState === 'function') {
                      const pState = playerInstanceRef.current.getPlayerState();
                      if (pState !== 1 && pState !== 3) {
                        setAutoplayBlocked(true);
                      }
                    }
                  }, 700);
                }
              },
              onStateChange: (event) => {
                if (event.data === 1) {
                  // PLAYING
                  setAutoplayBlocked(false);
                } else if (event.data === 2) {
                  // PAUSED
                  if (document.visibilityState === 'hidden' && wasPlayingBeforeHiddenRef.current) {
                    if (playerInstanceRef.current && typeof playerInstanceRef.current.playVideo === 'function') {
                      try {
                        playerInstanceRef.current.playVideo();
                      } catch {
                        // non-critical
                      }
                    }
                    return;
                  }
                } else if (event.data === 5) {
                  // CUED - if expecting playback, autoplay was restricted
                  if (isPlaying) {
                    setAutoplayBlocked(true);
                  }
                }
                if (handlerRef.current) {
                  handlerRef.current.handleStateChange(event.data, event.target);
                }
              },
              onError: (event) => {
                console.warn('[YouTubePlayer] onError:', event.data);
                if (handlerRef.current) {
                  handlerRef.current.handleError(event.data, 'YouTube iframe error');
                }
              },
            },
          })
        ),
    });

    return () => {
      // Retain player instance across re-renders
    };
  }, [setPlayerRef, setPlayerReady, volume, currentTrack, isPlaying, setAutoplayBlocked]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '200px',
        height: '200px',
        opacity: 0.001,
        pointerEvents: 'none',
        zIndex: -1,
      }}
      aria-hidden="true"
    >
      <div ref={containerRef} id="youtube-player" />
    </div>
  );
});

export default YouTubePlayer;
