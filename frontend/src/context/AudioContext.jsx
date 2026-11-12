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
  repeatMode: 'off',
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
  const initialRepeatMode = initialState.repeatMode || (initialState.isRepeat ? 'all' : 'off');
  const [repeatMode, setRepeatMode] = useState(initialRepeatMode);
  const [isRepeat, setIsRepeat] = useState(initialRepeatMode !== 'off');
  const [isEmptyPlayer, setIsEmptyPlayer] = useState(!defaultTrack);
  const [originalQueue, setOriginalQueue] = useState(defaultQueue);
  const originalQueueRef = useRef(defaultQueue);

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
    originalQueue,
    isShuffle,
    isRepeat,
    repeatMode,
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
      originalQueue,
      isShuffle,
      isRepeat,
      repeatMode,
      isPlaying,
      volume,
      currentTime,
      isEmptyPlayer,
    };
  }, [currentTrack, currentTrackIndex, queue, originalQueue, isShuffle, isRepeat, repeatMode, isPlaying, volume, currentTime, isEmptyPlayer]);

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
      repeatMode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, queue, volume, isShuffle, isRepeat, repeatMode]); // Note: currentTime excluded from direct dependency to prevent 500ms disk thrashing

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
        repeatMode: cur.repeatMode,
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

    let activeTrack = track;
    if (track.isPendingResolution || (track.videoId && String(track.videoId).startsWith('csv-'))) {
      try {
        const query = `${track.title} ${track.artist}`.trim();
        const searchRes = await apiClient.music.search(query, 1);
        const rawTracks = Array.isArray(searchRes?.tracks)
          ? searchRes.tracks
          : Array.isArray(searchRes?.data)
          ? searchRes.data
          : Array.isArray(searchRes?.data?.tracks)
          ? searchRes.data.tracks
          : Array.isArray(searchRes)
          ? searchRes
          : [];

        if (rawTracks.length > 0 && (rawTracks[0].videoId || rawTracks[0].id)) {
          const match = rawTracks[0];
          const realVid = match.videoId || match.id;
          activeTrack = {
            ...track,
            videoId: realVid,
            id: realVid,
            cover: match.thumbnailUrl || match.cover || track.cover,
            thumbnailUrl: match.thumbnailUrl || match.cover || track.thumbnailUrl,
            isPendingResolution: false,
          };
        }
      } catch (err) {
        console.warn('[AudioContext] Dynamic track resolution failed:', err);
      }
    }

    let effectiveQueue;
    let effectiveIndex;

    if (customQueue && Array.isArray(customQueue) && customQueue.length > 0) {
      setOriginalQueue(customQueue);
      originalQueueRef.current = customQueue;

      const foundIdx = customQueue.findIndex(
        (t) => (activeTrack.videoId && t.videoId === activeTrack.videoId) || t.id === activeTrack.id || (t.title === activeTrack.title && t.artist === activeTrack.artist)
      );
      const queueTrack = foundIdx !== -1 ? { ...customQueue[foundIdx], ...activeTrack } : activeTrack;

      if (stateRef.current.isShuffle && customQueue.length > 1) {
        const others = customQueue.filter((_, idx) => idx !== foundIdx);
        for (let i = others.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [others[i], others[j]] = [others[j], others[i]];
        }
        effectiveQueue = [queueTrack, ...others];
        effectiveIndex = 0;
      } else {
        effectiveQueue = foundIdx !== -1
          ? customQueue.map((t, idx) => (idx === foundIdx ? queueTrack : t))
          : customQueue;
        effectiveIndex = foundIdx !== -1 ? foundIdx : 0;
      }
      setQueue(effectiveQueue);
      setCurrentTrackIndex(effectiveIndex);
    } else {
      const currentQueue = stateRef.current.queue;
      const existsIndex = currentQueue.findIndex(
        (t) => (activeTrack.videoId && t.videoId === activeTrack.videoId) || t.id === activeTrack.id || (t.title === activeTrack.title && t.artist === activeTrack.artist)
      );
      if (existsIndex !== -1) {
        effectiveQueue = currentQueue.map((t, idx) => (idx === existsIndex ? { ...t, ...activeTrack } : t));
        effectiveIndex = existsIndex;
        setQueue(effectiveQueue);
        setCurrentTrackIndex(existsIndex);
      } else {
        const updatedQueue = [...currentQueue, activeTrack];
        effectiveQueue = updatedQueue;
        effectiveIndex = updatedQueue.length - 1;
        setQueue(updatedQueue);
        setCurrentTrackIndex(effectiveIndex);
        const updatedOriginal = [...(originalQueueRef.current || []), activeTrack];
        setOriginalQueue(updatedOriginal);
        originalQueueRef.current = updatedOriginal;
      }
    }

    // Update stateRef synchronously so locked-screen transitions never read stale React state
    stateRef.current = {
      ...stateRef.current,
      currentTrack: activeTrack,
      queue: effectiveQueue,
      isPlaying: true,
    };

    // Immediately kick off next-track stream preload in the background
    if (Array.isArray(effectiveQueue) && effectiveQueue.length > 1) {
      let nextCandidate = null;
      const curRepeat = stateRef.current.repeatMode;
      if (curRepeat === 'one') {
        nextCandidate = null;
      } else if (effectiveIndex < effectiveQueue.length - 1) {
        nextCandidate = effectiveQueue[effectiveIndex + 1];
      } else if (curRepeat === 'all') {
        nextCandidate = effectiveQueue[0];
      }

      if (
        nextCandidate?.videoId &&
        nextCandidate.videoId !== activeTrack.videoId &&
        playerRef.current &&
        typeof playerRef.current.preloadNextStreamUrl === 'function'
      ) {
        plannedNextRef.current = { fromVideoId: activeTrack.videoId, track: nextCandidate };
        playerRef.current.preloadNextStreamUrl(nextCandidate.videoId);
      } else {
        plannedNextRef.current = { fromVideoId: activeTrack.videoId, track: null };
      }
    }

    setCurrentTrack(activeTrack);
    if (!isSameTrack) {
      setCurrentTime(0);
    }
    if (activeTrack.seconds) {
      setDuration(activeTrack.seconds);
    }

    if (isSameTrack) {
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        try {
          await playerRef.current.playVideo();
        } catch (err) {
          console.warn('[AudioContext] Could not resume same track:', err);
        }
      }
    } else if (shouldLoadOnPlayerRef && playerRef.current && activeTrack.videoId) {
      try {
        await playerRef.current.loadVideoById({
          videoId: activeTrack.videoId,
          startSeconds: 0,
        });
      } catch (err) {
        console.warn('[AudioContext] Could not load video:', err);
      }
    }

    setIsPlaying(true);
    showToast(`Playing: ${activeTrack.title} — ${activeTrack.artist}`);

    try {
      const stored = localStorage.getItem('super_culture_playback_history');
      const hist = stored ? JSON.parse(stored) : [];
      const id = activeTrack.videoId || activeTrack.id;
      const historyItem = { ...activeTrack, playedAt: Date.now() };
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

    let nextTrack = null;
    if (repeatMode === 'one') {
      nextTrack = null;
    } else if (currentIndex < queue.length - 1) {
      nextTrack = queue[currentIndex + 1];
    } else if (repeatMode === 'all') {
      nextTrack = queue[0];
    }

    plannedNextRef.current = { fromVideoId: currentTrack.videoId, track: nextTrack };

    const player = playerRef.current;
    if (nextTrack?.videoId && player && typeof player.preloadNextStreamUrl === 'function') {
      player.preloadNextStreamUrl(nextTrack.videoId);
    }
  }, [currentTrack, currentTrackIndex, queue, isShuffle, repeatMode, isPlaying, isPlayerReady, playerEpoch]);

  // Handle track reaching its end naturally
  const handleTrackEnded = useCallback(() => {
    const { queue: currentQueue, currentTrack: activeTrack, repeatMode: curRepeat } = stateRef.current;
    if (!currentQueue || currentQueue.length === 0) return;

    // 1. Repeat ONE: loop current track immediately
    if (curRepeat === 'one') {
      if (playerRef.current) {
        if (typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(0);
        }
        if (typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
        }
      }
      return;
    }

    const currentIndex = currentQueue.findIndex(
      (t) => t.id === activeTrack?.id || (activeTrack?.videoId && t.videoId === activeTrack.videoId)
    );
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;

    // 2. Queue advance
    if (baseIndex < currentQueue.length - 1) {
      const nextTrack = currentQueue[baseIndex + 1];
      playSelectedTrack(nextTrack, currentQueue);
    } else if (curRepeat === 'all') {
      // 3. Repeat ALL: wrap to start
      const nextTrack = currentQueue[0];
      playSelectedTrack(nextTrack, currentQueue);
    } else {
      // 4. Repeat OFF: reached end of playlist, halt
      setIsPlaying(false);
    }
  }, [playSelectedTrack]);

  // Skip track forward or backward with direction (+1 or -1)
  const skipTrack = useCallback((direction = 1) => {
    if (isEmptyPlayer) {
      setIsEmptyPlayer(false);
    }

    const { queue: currentQueue, currentTrack: activeTrack } = stateRef.current;
    if (!currentQueue || currentQueue.length === 0) return;

    const currentIndex = currentQueue.findIndex(
      (t) => t.id === activeTrack?.id || (activeTrack?.videoId && t.videoId === activeTrack.videoId)
    );
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;

    let nextIndex;
    if (direction === 1) {
      nextIndex = (baseIndex + 1) % currentQueue.length;
    } else {
      nextIndex = (baseIndex - 1 + currentQueue.length) % currentQueue.length;
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
      const willBeShuffle = !prev;
      const curQueue = stateRef.current.queue;
      const curTrack = stateRef.current.currentTrack;

      if (willBeShuffle) {
        // Save current queue as originalQueue
        const savedOriginal = originalQueueRef.current?.length ? [...originalQueueRef.current] : [...curQueue];
        setOriginalQueue(savedOriginal);
        originalQueueRef.current = savedOriginal;

        if (curQueue.length > 1 && curTrack) {
          const curIndex = curQueue.findIndex(
            (t) => (curTrack.videoId && t.videoId === curTrack.videoId) || t.id === curTrack.id
          );
          const active = curIndex !== -1 ? curQueue[curIndex] : curTrack;
          const remaining = curQueue.filter((_, idx) => idx !== curIndex);

          // Fisher-Yates shuffle
          for (let i = remaining.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
          }

          const shuffled = [active, ...remaining];
          setQueue(shuffled);
          setCurrentTrackIndex(0);
          stateRef.current = {
            ...stateRef.current,
            queue: shuffled,
            currentTrackIndex: 0,
            isShuffle: true,
          };
        } else {
          stateRef.current = {
            ...stateRef.current,
            isShuffle: true,
          };
        }
        showToast('Shuffle Queue Enabled');
      } else {
        // Turning Shuffle OFF: restore originalQueue
        const restored = originalQueueRef.current?.length ? [...originalQueueRef.current] : [...curQueue];
        setQueue(restored);

        let restoredIndex = 0;
        if (curTrack) {
          const found = restored.findIndex(
            (t) => (curTrack.videoId && t.videoId === curTrack.videoId) || t.id === curTrack.id
          );
          if (found !== -1) restoredIndex = found;
        }
        setCurrentTrackIndex(restoredIndex);
        stateRef.current = {
          ...stateRef.current,
          queue: restored,
          currentTrackIndex: restoredIndex,
          isShuffle: false,
        };
        showToast('Shuffle Queue Disabled');
      }
      return willBeShuffle;
    });
  }, [showToast]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      let next;
      if (prev === 'off') {
        next = 'all';
        showToast('Repeat: All Tracks Active');
      } else if (prev === 'all') {
        next = 'one';
        showToast('Repeat: Current Track (1) Active');
      } else {
        next = 'off';
        showToast('Repeat Mode Off');
      }
      setIsRepeat(next !== 'off');
      stateRef.current = {
        ...stateRef.current,
        repeatMode: next,
        isRepeat: next !== 'off',
      };
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
        repeatMode,
        originalQueue,
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
        handleTrackEnded,
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
