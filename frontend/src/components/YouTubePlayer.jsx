import { useEffect, useRef, memo, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';

const YouTubePlayer = memo(function YouTubePlayer() {
  const {
    currentTrack,
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

  const containerRef = useRef(null);
  const playerInstanceRef = useRef(null);
  const isInitializedRef = useRef(false);
  const skipTrackRef = useRef(skipTrack);
  const skipNextRef = useRef(skipNext);
  const isRepeatRef = useRef(isRepeat);
  const initialVideoIdRef = useRef(currentTrack?.videoId);
  const initialTimeRef = useRef(currentTime);

  useEffect(() => {
    skipTrackRef.current = skipTrack;
  }, [skipTrack]);

  useEffect(() => {
    skipNextRef.current = skipNext;
  }, [skipNext]);

  useEffect(() => {
    isRepeatRef.current = isRepeat;
  }, [isRepeat]);

  useEffect(() => {
    if (isInitializedRef.current) return;

    const loadAPI = () => {
      return new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
          resolve();
          return;
        }

        // If the script tag is already in index.html, listen for onYouTubeIframeAPIReady
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

    const initPlayer = async () => {
      await loadAPI();
      if (isInitializedRef.current || !containerRef.current) return;
      isInitializedRef.current = true;

      playerInstanceRef.current = new window.YT.Player(containerRef.current, {
        height: '200',
        width: '200',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            console.log('[YouTubePlayer] Headless player ready.');
            setPlayerRef(event.target);
            setPlayerReady();
            event.target.setVolume(Math.round((volume || 0.74) * 100));

            if (initialVideoIdRef.current) {
              event.target.cueVideoById({
                videoId: initialVideoIdRef.current,
                startSeconds: initialTimeRef.current || 0,
              });
            }
          },
          onStateChange: (event) => {
            const state = event.data;

            if (state === window.YT.PlayerState.ENDED) {
              if (isRepeatRef.current) {
                event.target.seekTo(0);
                event.target.playVideo();
              } else {
                skipNextRef.current();
              }
              return;
            }

            if (state === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else if (state === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (state === window.YT.PlayerState.BUFFERING) {
              // Keep active state during brief buffering
            } else if (state === window.YT.PlayerState.CUED) {
              setIsPlaying(false);
            }
          },
          onError: (event) => {
            console.error(`[YouTubePlayer] Player error code: ${event.data}`);
            const errorCode = event.data;
            // Codes 100 (not found/private), 101/150 (embedding restricted by owner)
            if (errorCode === 100 || errorCode === 101 || errorCode === 150) {
              console.warn(`[YouTubePlayer] Track restricted/unavailable (code ${errorCode}). Auto-skipping...`);
              showToast('Track restricted by label • Skipping to next...');
              if (skipTrackRef.current) {
                skipTrackRef.current(1);
              } else if (skipNextRef.current) {
                skipNextRef.current();
              }
            }
          },
        },
      });
    };

    initPlayer();

    return () => {
      // Retain player instance across re-renders
    };
  }, [setPlayerRef, setPlayerReady, setIsPlaying, volume, showToast]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '-9999px',
        left: '-9999px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        pointerEvents: 'none',
        visibility: 'hidden',
      }}
      aria-hidden="true"
    >
      <div ref={containerRef} id="youtube-player" />
    </div>
  );
});

export default YouTubePlayer;

