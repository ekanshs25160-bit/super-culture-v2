/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState, useRef, useCallback } from 'react';
import playbackPersistence from '../services/playbackPersistence';
import { INITIAL_TRACK_QUEUE } from '../data/tracks';

export const AudioContext = createContext({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  currentTime: 0,
  progress: 0,
  duration: 0,
  volume: 0.74,
  isShuffle: false,
  isRepeat: false,
  isEmptyPlayer: false,
  toastMessage: null,
  isLiked: true,
  isAiDjActive: false,
  privacyMode: 'public',
  activeMood: { index: 0, name: 'Energetic' },
  playTrack: () => {},
  togglePlay: () => {},
  skipNext: () => {},
  skipPrev: () => {},
  skipPrevious: () => {},
  seekTo: () => {},
  setVolumeLevel: () => {},
  toggleShuffle: () => {},
  toggleRepeat: () => {},
  toggleEmptyPlayer: () => {},
  toggleLikeTrack: () => {},
  toggleAiDj: () => {},
  setPrivacyMode: () => {},
  setMood: () => {},
  showToast: () => {},
  setPlayerRef: () => {},
  setPlayerReady: () => {},
  setIsPlaying: () => {},
});

export const AudioProvider = ({ children }) => {
  const initialState = playbackPersistence.load();

  // If no saved track, initialize with first curated track from INITIAL_TRACK_QUEUE
  const defaultTrack = initialState.currentTrack || INITIAL_TRACK_QUEUE[0];
  const defaultQueue = (initialState.queue && initialState.queue.length > 0)
    ? initialState.queue
    : INITIAL_TRACK_QUEUE;

  const [currentTrack, setCurrentTrack] = useState(defaultTrack);
  const [queue, setQueue] = useState(defaultQueue);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialState.currentTime || 0);
  const [duration, setDuration] = useState(defaultTrack?.seconds || 252);
  const [volume, setVolume] = useState(typeof initialState.volume === 'number' ? initialState.volume : 0.74);
  const [isShuffle, setIsShuffle] = useState(Boolean(initialState.isShuffle));
  const [isRepeat, setIsRepeat] = useState(Boolean(initialState.isRepeat));
  const [isEmptyPlayer, setIsEmptyPlayer] = useState(false);

  // App-level interactive state
  const [isLiked, setIsLiked] = useState(true);
  const [isAiDjActive, setIsAiDjActive] = useState(false);
  const [privacyMode, setPrivacyModeState] = useState('public');
  const [activeMood, setActiveMood] = useState({ index: 0, name: 'Energetic' });
  const [toastMessage, setToastMessage] = useState(null);

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const playerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // Ref to always access latest state in callbacks without re-attaching listeners
  const stateRef = useRef({
    currentTrack,
    queue,
    isShuffle,
    isRepeat,
    isPlaying,
    volume,
    currentTime,
    isEmptyPlayer,
  });

  useEffect(() => {
    stateRef.current = {
      currentTrack,
      queue,
      isShuffle,
      isRepeat,
      isPlaying,
      volume,
      currentTime,
      isEmptyPlayer,
    };
  }, [currentTrack, queue, isShuffle, isRepeat, isPlaying, volume, currentTime, isEmptyPlayer]);

  // Sync to body paused-eq class
  useEffect(() => {
    if (isPlaying) {
      document.body.classList.remove('paused-eq');
    } else {
      document.body.classList.add('paused-eq');
    }
  }, [isPlaying]);

  // Persist state to localStorage
  useEffect(() => {
    playbackPersistence.save({
      currentTrack,
      queue,
      volume,
      currentTime,
      isShuffle,
      isRepeat,
    });
  }, [currentTrack, queue, volume, currentTime, isShuffle, isRepeat]);

  // Toast Trigger
  const showToast = useCallback((msg) => {
    if (!msg) return;
    setToastMessage(msg.toUpperCase());
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  }, []);

  // Set Player Ref from YouTubePlayer component
  const setPlayerRef = useCallback((player) => {
    playerRef.current = player;
  }, []);

  const setPlayerReady = useCallback(() => {
    setIsPlayerReady(true);
  }, []);

  // Play a track and optionally replace queue
  const playTrack = useCallback((track, newQueue = null) => {
    if (!track) return;

    if (isEmptyPlayer) {
      setIsEmptyPlayer(false);
    }

    if (newQueue && Array.isArray(newQueue) && newQueue.length > 0) {
      setQueue(newQueue);
    } else {
      // Ensure track exists in current queue
      setQueue((prevQueue) => {
        const exists = prevQueue.some((t) => t.id === track.id || (track.videoId && t.videoId === track.videoId));
        if (!exists) {
          return [...prevQueue, track];
        }
        return prevQueue;
      });
    }

    setCurrentTrack(track);
    setCurrentTime(0);
    if (track.seconds) {
      setDuration(track.seconds);
    }

    if (playerRef.current && track.videoId) {
      try {
        playerRef.current.loadVideoById({
          videoId: track.videoId,
          startSeconds: 0,
        });
        playerRef.current.playVideo();
      } catch (err) {
        console.warn('[AudioContext] Could not load video:', err);
      }
    }

    setIsPlaying(true);
    showToast(`Playing: ${track.title} — ${track.artist}`);
  }, [isEmptyPlayer, showToast]);

  // Toggle master Play / Pause
  const togglePlay = useCallback(() => {
    if (isEmptyPlayer) {
      setIsEmptyPlayer(false);
    }

    if (!currentTrack) {
      if (queue.length > 0) {
        playTrack(queue[0]);
      }
      return;
    }

    if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
      try {
        if (isPlaying) {
          playerRef.current.pauseVideo();
          setIsPlaying(false);
        } else {
          playerRef.current.playVideo();
          setIsPlaying(true);
        }
      } catch (e) {
        console.warn('[AudioContext] Error toggling play state:', e);
        setIsPlaying(!isPlaying);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  }, [isEmptyPlayer, currentTrack, queue, isPlaying, playTrack]);

  // Skip to next track
  const skipNext = useCallback(() => {
    if (isEmptyPlayer) {
      setIsEmptyPlayer(false);
    }

    const { queue: currentQueue, currentTrack: activeTrack, isShuffle: shuffle } = stateRef.current;
    if (!currentQueue || currentQueue.length === 0) return;

    const currentIndex = currentQueue.findIndex((t) => t.id === activeTrack?.id || (activeTrack?.videoId && t.videoId === activeTrack.videoId));
    let nextIndex;

    if (shuffle && currentQueue.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * currentQueue.length);
      } while (nextIndex === currentIndex);
    } else {
      nextIndex = (currentIndex + 1 + currentQueue.length) % currentQueue.length;
    }

    const nextTrack = currentQueue[nextIndex];
    if (nextTrack) {
      playTrack(nextTrack);
      showToast(`Now Playing: ${nextTrack.title}`);
    }
  }, [isEmptyPlayer, playTrack, showToast]);

  // Skip to previous track
  const skipPrev = useCallback(() => {
    if (isEmptyPlayer) {
      setIsEmptyPlayer(false);
    }

    const { queue: currentQueue, currentTrack: activeTrack } = stateRef.current;
    if (!currentQueue || currentQueue.length === 0) return;

    const currentIndex = currentQueue.findIndex((t) => t.id === activeTrack?.id || (activeTrack?.videoId && t.videoId === activeTrack.videoId));
    const prevIndex = currentIndex <= 0 ? currentQueue.length - 1 : currentIndex - 1;
    const prevTrack = currentQueue[prevIndex];

    if (prevTrack) {
      playTrack(prevTrack);
      showToast(`Now Playing: ${prevTrack.title}`);
    }
  }, [isEmptyPlayer, playTrack, showToast]);

  // Seek playback to specific timestamp in seconds
  const seekTo = useCallback((seconds) => {
    if (isEmptyPlayer) return;
    const target = Math.max(0, Math.min(seconds, duration || 252));
    setCurrentTime(target);

    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      try {
        playerRef.current.seekTo(target, true);
      } catch (err) {
        console.warn('[AudioContext] seekTo error:', err);
      }
    }
  }, [isEmptyPlayer, duration]);

  // Volume control (accepts percentage 0-100 or fraction 0-1)
  const setVolumeLevel = useCallback((val) => {
    const fraction = val > 1 ? val / 100 : val;
    const clamped = Math.max(0, Math.min(1, fraction));
    setVolume(clamped);

    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(Math.round(clamped * 100));
      } catch (err) {
        console.warn('[AudioContext] setVolume error:', err);
      }
    }
    showToast(`Output Volume: ${Math.round(clamped * 100)}%`);
  }, [showToast]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const next = !prev;
      showToast(next ? 'Shuffle Queue Enabled' : 'Shuffle Queue Disabled');
      return next;
    });
  }, [showToast]);

  const toggleRepeat = useCallback(() => {
    setIsRepeat((prev) => {
      const next = !prev;
      showToast(next ? 'Repeat Track Active' : 'Repeat Mode Off');
      return next;
    });
  }, [showToast]);

  const toggleEmptyPlayer = useCallback((forceState) => {
    setIsEmptyPlayer((prev) => {
      const next = typeof forceState === 'boolean' ? forceState : !prev;
      if (next) {
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
        }
        setIsPlaying(false);
        showToast('Player Empty State: NO TRACK / Select a track');
      } else {
        showToast('Player Active Track Restored');
      }
      return next;
    });
  }, [showToast]);

  const toggleLikeTrack = useCallback(() => {
    setIsLiked((prev) => {
      const next = !prev;
      showToast(next ? 'Saved to Liked Songs (875)' : 'Removed from Liked Songs');
      return next;
    });
  }, [showToast]);

  const toggleAiDj = useCallback(() => {
    setIsAiDjActive((prev) => {
      const next = !prev;
      if (next) {
        playTrack({
          id: 'ai-dj-xtal',
          title: 'AI DJ Transition • Xtal',
          artist: 'Aphex Twin (Super Culture Stem Mix)',
          cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=300&q=80',
          duration: '4:52',
          seconds: 292,
          videoId: '2tOutF8B3f8',
        });
        showToast('AI DJ Active • Mixing Archive Cuts');
      } else {
        showToast('AI DJ Paused');
      }
      return next;
    });
  }, [playTrack, showToast]);

  const setPrivacyMode = useCallback((mode) => {
    setPrivacyModeState(mode);
    if (mode === 'public') {
      showToast('Public Listening Mode Enabled');
    } else {
      showToast('Private Mode Active • Activity Hidden');
    }
  }, [showToast]);

  const setMood = useCallback((index, name) => {
    setActiveMood({ index, name });
    showToast(`Mood Updated: I feel ${name} today`);
  }, [showToast]);

  // Polling playback time & duration while playing
  useEffect(() => {
    if (isPlaying && isPlayerReady) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            const time = playerRef.current.getCurrentTime();
            const dur = playerRef.current.getDuration();
            if (typeof time === 'number' && !isNaN(time)) {
              setCurrentTime(time);
            }
            if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
              setDuration(dur);
            }
          } catch {
            // Polling might occasionally throw if player is buffering or reloading
          }
        }
      }, 500);
    } else {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, isPlayerReady]);

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        queue,
        isPlaying,
        currentTime,
        progress: currentTime, // backwards-compatible alias
        duration,
        volume,
        isShuffle,
        isRepeat,
        isEmptyPlayer,
        toastMessage,
        isLiked,
        isAiDjActive,
        privacyMode,
        activeMood,
        playTrack,
        togglePlay,
        skipNext,
        skipPrev,
        skipPrevious: skipPrev,
        seekTo,
        setVolumeLevel,
        toggleShuffle,
        toggleRepeat,
        toggleEmptyPlayer,
        toggleLikeTrack,
        toggleAiDj,
        setPrivacyMode,
        setMood,
        showToast,
        setPlayerRef,
        setPlayerReady,
        setIsPlaying,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export default AudioContext;
