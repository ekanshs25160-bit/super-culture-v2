/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState, useRef, useCallback } from 'react';
import playbackPersistence from '../services/playbackPersistence';
import { useUiStore } from '../store/useUiStore';
import { prepareTrackSelection } from '../engine/trackTransitionSync';

export const AudioContext = createContext({
  currentTrack: null,
  currentTrackIndex: 0,
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
  unlock: () => {},
  playSelectedTrack: () => {},
  playTrack: () => {},
  skipTrack: () => {},
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

  // Initial state strictly defaults to empty queue and null track
  const defaultTrack = initialState.currentTrack || null;
  const defaultQueue = Array.isArray(initialState.queue) ? initialState.queue : [];

  const [currentTrack, setCurrentTrack] = useState(defaultTrack);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(() => {
    if (!defaultTrack || defaultQueue.length === 0) return 0;
    const idx = defaultQueue.findIndex(
      (t) => (defaultTrack?.videoId && t.videoId === defaultTrack.videoId) || t.id === defaultTrack?.id
    );
    return idx !== -1 ? idx : 0;
  });
  const [queue, setQueue] = useState(defaultQueue);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialState.currentTime || 0);
  const [duration, setDuration] = useState(defaultTrack?.seconds || 0);
  const [volume, setVolume] = useState(typeof initialState.volume === 'number' ? initialState.volume : 0.74);
  const [isShuffle, setIsShuffle] = useState(Boolean(initialState.isShuffle));
  const [isRepeat, setIsRepeat] = useState(Boolean(initialState.isRepeat));
  const [isEmptyPlayer, setIsEmptyPlayer] = useState(!defaultTrack);

  // App-level interactive state
  const [isLiked, setIsLiked] = useState(true);
  const [isAiDjActive, setIsAiDjActive] = useState(false);
  const [privacyMode, setPrivacyModeState] = useState('public');
  const [activeMood, setActiveMood] = useState({ index: 0, name: 'Energetic' });
  const [toastMessage, setToastMessage] = useState(null);

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerEpoch, setPlayerEpoch] = useState(0);
  const playerRef = useRef(null);
  // Next track chosen ahead of time (needed so shuffle skips land on the pre-resolved URL)
  const plannedNextRef = useRef({ fromVideoId: null, track: null });
  const progressIntervalRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // Ref to always access latest state in callbacks without re-attaching listeners
  const stateRef = useRef({
    currentTrack,
    currentTrackIndex,
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
      currentTrackIndex,
      queue,
      isShuffle,
      isRepeat,
      isPlaying,
      volume,
      currentTime,
      isEmptyPlayer,
    };
  }, [currentTrack, currentTrackIndex, queue, isShuffle, isRepeat, isPlaying, volume, currentTime, isEmptyPlayer]);

  // Sync to body paused-eq class
  useEffect(() => {
    if (isPlaying) {
      document.body.classList.remove('paused-eq');
    } else {
      document.body.classList.add('paused-eq');
    }
  }, [isPlaying]);

  // Persist state to localStorage on track, queue, or control setting changes
  useEffect(() => {
    playbackPersistence.save({
      currentTrack,
      queue,
      volume,
      currentTime,
      isShuffle,
      isRepeat,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, queue, volume, isShuffle, isRepeat]); // Note: currentTime excluded from direct dependency to prevent 500ms disk thrashing

  // Periodic 5-second state persistence while playing + pagehide / visibilitychange listeners (for mobile background preservation)
  useEffect(() => {
    const saveCurrentPlaybackState = () => {
      const cur = stateRef.current;
      playbackPersistence.save({
        currentTrack: cur.currentTrack,
        queue: cur.queue,
        volume: cur.volume,
        currentTime: cur.currentTime,
        isShuffle: cur.isShuffle,
        isRepeat: cur.isRepeat,
      });
    };

    const interval = setInterval(() => {
      if (stateRef.current.isPlaying) {
        saveCurrentPlaybackState();
      }
    }, 5000);

    const handlePageHide = () => {
      saveCurrentPlaybackState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentPlaybackState();
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      saveCurrentPlaybackState();
    };
  }, []);

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
    if (playerRef.current !== player) {
      playerRef.current = player;
      setPlayerEpoch((n) => n + 1);
    } else {
      playerRef.current = player;
    }
  }, []);

  const setPlayerReady = useCallback(() => {
    setIsPlayerReady(true);
  }, []);

  // Synchronously unlock audio inside user gesture
  const unlock = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.unlock === 'function') {
      playerRef.current.unlock();
    }
  }, []);

  // Play a track and dynamically replace or update queue
  const playSelectedTrack = useCallback(async (track, customQueue = null) => {
    if (!track) return;

    const previousTrackVideoId = stateRef.current.currentTrack?.videoId || null;
    const { shouldLoadOnPlayerRef, isSameTrack } = prepareTrackSelection({
      track,
      currentTrackVideoId: previousTrackVideoId,
      playerRef,
      uiStore: useUiStore,
    });

    // Synchronously unlock audio on the native player inside user gesture BEFORE any await!
    if (playerRef.current && typeof playerRef.current.unlock === 'function') {
      playerRef.current.unlock();
    }

    if (isEmptyPlayer) {
      setIsEmptyPlayer(false);
    }

    let effectiveQueue;
    let effectiveIndex;

    if (customQueue && Array.isArray(customQueue) && customQueue.length > 0) {
      effectiveQueue = customQueue;
      setQueue(customQueue);
      const foundIdx = customQueue.findIndex(
        (t) => (track.videoId && t.videoId === track.videoId) || t.id === track.id
      );
      effectiveIndex = foundIdx !== -1 ? foundIdx : 0;
      setCurrentTrackIndex(effectiveIndex);
    } else {
      const currentQueue = stateRef.current.queue;
      const existsIndex = currentQueue.findIndex(
        (t) => (track.videoId && t.videoId === track.videoId) || t.id === track.id
      );
      if (existsIndex !== -1) {
        effectiveQueue = currentQueue;
        effectiveIndex = existsIndex;
        setCurrentTrackIndex(existsIndex);
      } else {
        const updatedQueue = [...currentQueue, track];
        effectiveQueue = updatedQueue;
        effectiveIndex = updatedQueue.length - 1;
        setQueue(updatedQueue);
        setCurrentTrackIndex(effectiveIndex);
      }
    }

    // Update stateRef synchronously so locked-screen transitions never read stale React state
    stateRef.current = {
      ...stateRef.current,
      currentTrack: track,
      queue: effectiveQueue,
      isPlaying: true,
    };

    // Immediately kick off next-track stream preload in the background
    if (Array.isArray(effectiveQueue) && effectiveQueue.length > 1) {
      const nextIdx = (effectiveIndex + 1) % effectiveQueue.length;
      const nextCandidate = effectiveQueue[nextIdx];
      if (
        nextCandidate?.videoId &&
        nextCandidate.videoId !== track.videoId &&
        playerRef.current &&
        typeof playerRef.current.preloadNextStreamUrl === 'function'
      ) {
        plannedNextRef.current = { fromVideoId: track.videoId, track: nextCandidate };
        playerRef.current.preloadNextStreamUrl(nextCandidate.videoId);
      }
    }

    setCurrentTrack(track);
    if (!isSameTrack) {
      setCurrentTime(0);
    }
    if (track.seconds) {
      setDuration(track.seconds);
    }

    if (isSameTrack) {
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        try {
          await playerRef.current.playVideo();
        } catch (err) {
          console.warn('[AudioContext] Could not resume same track:', err);
        }
      }
    } else if (shouldLoadOnPlayerRef && playerRef.current && track.videoId) {
      try {
        await playerRef.current.loadVideoById({
          videoId: track.videoId,
          startSeconds: 0,
        });
      } catch (err) {
        console.warn('[AudioContext] Could not load video:', err);
      }
    }

    setIsPlaying(true);
    showToast(`Playing: ${track.title} — ${track.artist}`);

    try {
      const stored = localStorage.getItem('super_culture_playback_history');
      const hist = stored ? JSON.parse(stored) : [];
      const id = track.videoId || track.id;
      const historyItem = { ...track, playedAt: Date.now() };
      const filtered = Array.isArray(hist) ? hist.filter((t) => (t.videoId || t.id) !== id) : [];
      localStorage.setItem('super_culture_playback_history', JSON.stringify([historyItem, ...filtered].slice(0, 50)));
      window.dispatchEvent(new Event('super_culture_history_updated'));
    } catch (e) {
      console.warn('[AudioContext] Could not save history:', e);
    }
  }, [isEmptyPlayer, showToast]);

  const playTrack = playSelectedTrack;

  // Toggle master Play / Pause
  const togglePlay = useCallback(() => {
    // Synchronously unlock audio inside user gesture
    if (playerRef.current && typeof playerRef.current.unlock === 'function') {
      playerRef.current.unlock();
    }

    if (isEmptyPlayer) {
      setIsEmptyPlayer(false);
    }

    if (!currentTrack) {
      if (queue.length > 0) {
        playSelectedTrack(queue[0], queue);
      } else {
        showToast('No track selected • Pick a song to play');
      }
      return;
    }

    if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
      try {
        const actualState = playerRef.current.getPlayerState();
        // If actually playing (1) or buffering (3), pause; if cued (5), paused (2), or unstarted (-1), play
        const isActuallyPlaying = actualState === 1 || actualState === 3;
        if (isActuallyPlaying) {
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
  }, [isEmptyPlayer, currentTrack, queue, isPlaying, playSelectedTrack, showToast]);

  // Pre-resolve the next track's stream URL while the current one plays, so the ended -> play() hand-off
  // (and lock-screen "Next") needs no network await.
  useEffect(() => {
    if (!currentTrack?.videoId || !Array.isArray(queue) || queue.length < 2) {
      plannedNextRef.current = { fromVideoId: null, track: null };
      return;
    }
    const currentIndex = queue.findIndex(
      (t) => t.id === currentTrack.id || t.videoId === currentTrack.videoId
    );
    if (currentIndex === -1) return;

    let nextTrack;
    const planned = plannedNextRef.current;
    const plannedStillValid =
      isShuffle &&
      planned.fromVideoId === currentTrack.videoId &&
      planned.track &&
      planned.track.videoId !== currentTrack.videoId &&
      queue.some((t) => t.videoId === planned.track.videoId);
    if (plannedStillValid) {
      nextTrack = planned.track;
    } else if (isShuffle) {
      let idx;
      do {
        idx = Math.floor(Math.random() * queue.length);
      } while (idx === currentIndex);
      nextTrack = queue[idx];
    } else {
      nextTrack = queue[(currentIndex + 1) % queue.length];
    }

    plannedNextRef.current = { fromVideoId: currentTrack.videoId, track: nextTrack };

    const player = playerRef.current;
    if (nextTrack?.videoId && player && typeof player.preloadNextStreamUrl === 'function') {
      player.preloadNextStreamUrl(nextTrack.videoId);
    }
  }, [currentTrack, currentTrackIndex, queue, isShuffle, isPlaying, isPlayerReady, playerEpoch]);

  // Skip track forward or backward with direction (+1 or -1)
  const skipTrack = useCallback((direction = 1) => {
    if (isEmptyPlayer) {
      setIsEmptyPlayer(false);
    }

    const { queue: currentQueue, currentTrack: activeTrack, isShuffle: shuffle } = stateRef.current;
    if (!currentQueue || currentQueue.length === 0) return;

    const currentIndex = currentQueue.findIndex(
      (t) => t.id === activeTrack?.id || (activeTrack?.videoId && t.videoId === activeTrack.videoId)
    );

    let nextIndex;
    const planned = plannedNextRef.current;
    const plannedIndex =
      direction === 1 && planned.track && planned.fromVideoId === (activeTrack?.videoId || null)
        ? currentQueue.findIndex((t) => t.id === planned.track.id || (planned.track.videoId && t.videoId === planned.track.videoId))
        : -1;
    if (plannedIndex !== -1 && plannedIndex !== currentIndex) {
      nextIndex = plannedIndex;
    } else if (shuffle && currentQueue.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * currentQueue.length);
      } while (nextIndex === currentIndex);
    } else {
      const baseIndex = currentIndex >= 0 ? currentIndex : 0;
      nextIndex = (baseIndex + direction + currentQueue.length) % currentQueue.length;
    }

    const nextTrack = currentQueue[nextIndex];
    if (nextTrack) {
      playSelectedTrack(nextTrack, currentQueue);
      showToast(`Now Playing: ${nextTrack.title}`);
    }
  }, [isEmptyPlayer, playSelectedTrack, showToast]);

  // Skip to next track
  const skipNext = useCallback(() => skipTrack(1), [skipTrack]);

  // Skip to previous track
  const skipPrev = useCallback(() => skipTrack(-1), [skipTrack]);

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
      showToast(next ? 'Saved to Liked Songs' : 'Removed from Liked Songs');
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
        currentTrackIndex,
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
        unlock,
        playSelectedTrack,
        playTrack,
        skipTrack,
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
