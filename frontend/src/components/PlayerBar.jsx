import { useContext, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Plus, SlidersHorizontal, Play, Pause } from 'lucide-react';
import { AudioContext } from '../context/AudioContext';
import { useLibraryStore } from '../store/useLibraryStore';
import { useUiStore } from '../store/useUiStore';
import { apiClient } from '../services/api';
import PlayerTransport from './player/PlayerTransport';
import PlayerUtilities from './player/PlayerUtilities';
import PlayerTray from './player/PlayerTray';
import NowPlayingSheet from './player/NowPlayingSheet';
import CoverImage from './shared/CoverImage';

const formatTime = (sec) => {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function PlayerBar() {
  const {
    currentTrack, queue, isPlaying, currentTime, duration, volume,
    isShuffle, isRepeat, repeatMode, isEmptyPlayer, toastMessage, playTrack,
    togglePlay, skipNext, skipPrev, seekTo, setVolumeLevel,
    toggleShuffle, toggleRepeat, showToast, unlock,
  } = useContext(AudioContext);

  const isLiked = useLibraryStore((s) => s.isLiked(currentTrack?.videoId || currentTrack?.id));
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const openAddToPlaylist = useUiStore((s) => s.openAddToPlaylist);
  const isAutoplayBlocked = useUiStore((s) => s.isAutoplayBlocked);
  const setAutoplayBlocked = useUiStore((s) => s.setAutoplayBlocked);
  const navigate = useNavigate();

  const progressTrackRef = useRef(null);
  const volumeTrackRef = useRef(null);
  const trayRef = useRef(null);
  const [serverUpNext, setServerUpNext] = useState(null);
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const lastLoggedRef = useRef(null);

  // Close tray on click outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (trayRef.current && !trayRef.current.contains(e.target)) setIsTrayOpen(false);
    };
    if (isTrayOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isTrayOpen]);

  // Active queue next track
  const currentIndex = queue.findIndex(
    (t) => t.id === currentTrack?.id || (currentTrack?.videoId && t.videoId === currentTrack.videoId)
  );
  const queueNextTrack = queue.length > 1
    ? queue[(currentIndex + 1 + queue.length) % queue.length]
    : queue[0] || currentTrack;

  useEffect(() => {
    if (!currentTrack?.videoId) return;
    let isMounted = true;

    apiClient.music.getUpNext(currentTrack.videoId)
      .then((res) => {
        if (isMounted && res?.tracks?.length > 0) {
          const raw = res.tracks[0];
          setServerUpNext({
            ...raw,
            id: raw.videoId || raw.id,
            cover: raw.cover || raw.thumbnailUrl || raw.thumbnail_url,
          });
        }
      })
      .catch(() => {});

    const trackKey = `${currentTrack.videoId || currentTrack.id}_${currentTrack.title}`;
    if (isPlaying && lastLoggedRef.current !== trackKey) {
      lastLoggedRef.current = trackKey;
      apiClient.ai.logHistory({
        title: currentTrack.title,
        artist: currentTrack.artist,
        videoId: currentTrack.videoId || currentTrack.id,
      }).catch(() => {});
    }

    return () => { isMounted = false; };
  }, [currentTrack, isPlaying]);

  const nextTrack = (queue && queue.length > 1) ? queueNextTrack : (serverUpNext || queueNextTrack);

  const handleLikeClick = (e) => {
    e.stopPropagation();
    if (!currentTrack) return;
    const wasLiked = isLiked;
    toggleLike(currentTrack);
    showToast(!wasLiked ? 'Saved to Liked Songs' : 'Removed from Liked Songs');
  };

  const handleMasterPlay = () => {
    if (typeof unlock === 'function') {
      unlock();
    }
    if (isAutoplayBlocked) {
      setAutoplayBlocked(false);
    }
    if (isEmptyPlayer || !currentTrack) {
      if (queue && queue.length > 0) {
        playTrack(queue[0]);
        return;
      }
    }
    togglePlay();
  };

  const handleSkipNext = () => {
    skipNext();
  };

  const handleSkipPrev = () => {
    skipPrev();
  };

  const handleNextClick = () => {
    if (queue.length > 1) {
      handleSkipNext();
    } else if (serverUpNext) {
      playTrack(serverUpNext);
    } else {
      handleSkipNext();
    }
  };

  const currentSeconds = Math.floor(currentTime || 0);
  const totalSeconds = Math.floor(duration || (currentTrack?.seconds || 252));
  const progressPct = totalSeconds > 0
    ? Math.min(100, Math.max(0, (currentTime / totalSeconds) * 100))
    : 0;
  const volumePct = Math.round((volume ?? 0.74) * 100);

  const handleSeekClick = (e) => {
    if (isEmptyPlayer || !progressTrackRef.current) return;
    const rect = progressTrackRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const target = ratio * totalSeconds;
    seekTo(target);
  };

  const handleVolumeClick = (e) => {
    const el = volumeTrackRef.current || e.currentTarget;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setVolumeLevel(ratio);
  };

  return (
    <>
      <footer
        style={{
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        }}
        className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none"
      >
        <div className="w-full max-w-[1600px] px-3 sm:px-5 pointer-events-auto relative">
          <PlayerTray
            isOpen={isTrayOpen}
            trayRef={trayRef}
            isShuffle={isShuffle}
            isRepeat={isRepeat}
            repeatMode={repeatMode}
            volumePct={volumePct}
            onToggleShuffle={toggleShuffle}
            onToggleRepeat={toggleRepeat}
            onVolumeClick={handleVolumeClick}
            onAddToPlaylist={(e) => {
              e.stopPropagation();
              if (currentTrack) openAddToPlaylist(currentTrack);
              setIsTrayOpen(false);
            }}
          />

          {/* 1. MOBILE MINI-PLAYER (< md) */}
          <div
            onClick={() => {
              if (currentTrack) setIsSheetOpen(true);
            }}
            role="button"
            tabIndex={0}
            aria-label="Open full screen now playing controls"
            className="md:hidden sc-oled-bar px-3 py-2 flex items-center justify-between gap-3 relative overflow-hidden cursor-pointer active:scale-[0.99] transition select-none shadow-2xl"
          >
            {/* Hairline Progress Indicator */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10">
              <div
                className="h-full bg-[#1ED760] transition-all duration-100"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Mini Player Left: Artwork + Title + Artist */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="relative w-10 h-10 shrink-0">
                <CoverImage
                  src={currentTrack?.cover}
                  alt=""
                  iconSize="w-4 h-4"
                  className="w-10 h-10 rounded-xl object-cover border border-white/15"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#F4F4F2] truncate">
                  {currentTrack?.title || 'No Track Playing'}
                </p>
                <p className="text-[11px] text-[#8A8A8E] truncate">
                  {currentTrack?.artist || 'Select a track to start'}
                </p>
              </div>
            </div>

            {/* Mini Player Right Actions: Like + Master Play/Pause */}
            <div
              className="flex items-center gap-1.5 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {currentTrack && (
                <button
                  onClick={handleLikeClick}
                  aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                  className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 ${
                    isLiked ? 'text-[#1ED760]' : 'text-[#8A8A8E] hover:text-white'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                </button>
              )}

              {isAutoplayBlocked ? (
                <button
                  onClick={handleMasterPlay}
                  aria-label="Tap to play audio stream"
                  className="min-h-[44px] px-3.5 rounded-full bg-[#1ED760] text-[#0B0B0C] text-[11px] font-bold flex items-center gap-1.5 shadow-md shadow-[#1ED760]/30 transition animate-pulse active:scale-95 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>PLAY</span>
                </button>
              ) : (
                <button
                  onClick={handleMasterPlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="min-w-[44px] min-h-[44px] rounded-full bg-[#F4F4F2] text-[#0B0B0C] flex items-center justify-center shadow-md transition active:scale-95 cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* 2. DESKTOP FULL OLED BAR (>= md) */}
          <div className="hidden md:flex sc-oled-bar px-3 sm:px-4 py-2 sm:py-2.5 flex-row items-center justify-between gap-4">
            {/* LEFT: Album Art, Track Title, Artist, Heart, Add Button */}
            <div className="flex items-center gap-2.5 sm:gap-3 w-[30%] min-w-0">
              {!isEmptyPlayer && currentTrack ? (
                <div id="player-left-active" className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-full">
                  <div className="relative w-10 h-10 sm:w-12 sm:h-12 shrink-0">
                    <CoverImage
                      id="player-cover"
                      src={currentTrack.cover}
                      alt=""
                      iconSize="w-4 h-4"
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl object-cover border border-white/15 shadow-md"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p id="player-title" className="text-xs sm:text-sm font-semibold text-[#F4F4F2] truncate">
                      {currentTrack.title}
                    </p>
                    <p
                      id="player-artist"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (currentTrack.artist) navigate(`/artist/${encodeURIComponent(currentTrack.artist)}`);
                      }}
                      className="text-[11px] sm:text-xs text-[#8A8A8E] truncate hover:underline hover:text-[#1ED760] transition cursor-pointer"
                    >
                      {currentTrack.artist}
                    </p>
                  </div>

                  <button
                    id="like-btn"
                    onClick={handleLikeClick}
                    aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                    className={`min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center transition shrink-0 cursor-pointer ${
                      isLiked
                        ? 'bg-[#1ED760]/15 border border-[#1ED760]/40 text-[#1ED760] shadow-[0_0_12px_rgba(30,215,96,0.3)]'
                        : 'bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-[#F4F4F2] hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLiked ? 'fill-current' : ''}`} aria-hidden="true" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddToPlaylist(currentTrack);
                    }}
                    aria-label="Add track to playlist"
                    className="flex min-w-[40px] min-h-[40px] rounded-full bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 items-center justify-center text-[#F4F4F2] hover:text-white transition shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div id="player-left-empty" className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-full">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/10 border border-dashed border-white/15 flex items-center justify-center text-[#8A8A8E] shrink-0 font-mono text-[9px] sm:text-[10px]">
                    OFF
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="meta-label text-[#F4F4F2]">NO TRACK</p>
                    <p className="text-[11px] sm:text-xs text-[#8A8A8E] truncate mt-0.5">Select a track</p>
                  </div>
                </div>
              )}
            </div>

            {/* CENTER: Transport Controls & Scrubber */}
            <PlayerTransport
              isPlaying={isPlaying}
              isEmptyPlayer={isEmptyPlayer}
              isAutoplayBlocked={isAutoplayBlocked}
              isShuffle={isShuffle}
              isRepeat={isRepeat}
              repeatMode={repeatMode}
              currentSeconds={currentSeconds}
              totalSeconds={totalSeconds}
              progressPct={progressPct}
              progressTrackRef={progressTrackRef}
              formatTime={formatTime}
              onTogglePlay={handleMasterPlay}
              onToggleShuffle={toggleShuffle}
              onToggleRepeat={toggleRepeat}
              onSkipPrev={handleSkipPrev}
              onSkipNext={handleSkipNext}
              onSeekClick={handleSeekClick}
            />

            {/* RIGHT: "UP NEXT" Pill & Volume (Desktop) */}
            <div className="flex items-center justify-end gap-2 w-[30%] shrink-0">
              <PlayerUtilities
                nextTrack={nextTrack}
                volumeTrackRef={volumeTrackRef}
                volumePct={volumePct}
                onNextClick={handleNextClick}
                onVolumeClick={handleVolumeClick}
              />
            </div>
          </div>
        </div>
      </footer>

      {/* Full-screen Now-Playing Sheet for Mobile */}
      <NowPlayingSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        isAutoplayBlocked={isAutoplayBlocked}
        isShuffle={isShuffle}
        isRepeat={isRepeat}
        repeatMode={repeatMode}
        isLiked={isLiked}
        currentTime={currentSeconds}
        duration={totalSeconds}
        progressPct={progressPct}
        queue={queue}
        formatTime={formatTime}
        onTogglePlay={handleMasterPlay}
        onSkipPrev={handleSkipPrev}
        onSkipNext={handleNextClick}
        onSeek={(sec) => {
          seekTo(sec);
        }}
        onToggleShuffle={toggleShuffle}
        onToggleRepeat={toggleRepeat}
        onToggleLike={handleLikeClick}
        onSelectTrack={(track) => {
          playTrack(track);
        }}
        onAddToPlaylist={() => {
          if (currentTrack) openAddToPlaylist(currentTrack);
        }}
      />

      {/* Floating Editorial Toast Notification */}
      <div
        id="sc-toast"
        style={{
          bottom: 'calc(max(5.5rem, env(safe-area-inset-bottom, 0px) + 5rem))',
        }}
        className={`fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 sc-pill px-4 py-2 flex items-center gap-2.5 shadow-2xl ${
          toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-[#1ED760] glow-green-sm" />
        <span id="sc-toast-text" className="meta-label text-[#F4F4F2]">
          {toastMessage || 'SYSTEM READY'}
        </span>
      </div>
    </>
  );
}
