import React, { useState, useRef } from 'react';
import {
  ChevronDown,
  Heart,
  Plus,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  ListMusic,
  Volume2,
  Sparkles,
} from 'lucide-react';
import CoverImage from '../shared/CoverImage';

export default function NowPlayingSheet({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  isAutoplayBlocked,
  isShuffle,
  isRepeat,
  repeatMode = 'off',
  isLiked,
  currentTime,
  duration,
  progressPct,
  queue,
  formatTime,
  onTogglePlay,
  onSkipPrev,
  onSkipNext,
  onSeek,
  onToggleShuffle,
  onToggleRepeat,
  onToggleLike,
  onSelectTrack,
  onAddToPlaylist,
}) {
  const [showQueue, setShowQueue] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const sheetRef = useRef(null);
  const progressBarRef = useRef(null);

  const handleClose = () => {
    setDragOffset(0);
    setIsDragging(false);
    setShowQueue(false);
    onClose();
  };

  if (!isOpen || !currentTrack) return null;

  // Swipe-down gesture handling
  const handleTouchStart = (e) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startYRef.current;
    if (deltaY > 0) {
      setDragOffset(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragOffset > 100) {
      handleClose();
    } else {
      setDragOffset(0);
    }
  };

  const handleSeekTouch = (e) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now Playing full-screen controls"
      ref={sheetRef}
      style={{
        transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : 'translateY(0)',
        transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 bg-[#0B0B0C]/98 backdrop-blur-3xl flex flex-col justify-between overflow-hidden select-none animate-in slide-in-from-bottom duration-300"
    >
      {/* 1. Header with Drag Handle & Close */}
      <div className="flex flex-col items-center shrink-0 w-full mb-3">
        {/* Swipe drag indicator bar */}
        <div className="w-12 h-1.5 rounded-full bg-white/20 mb-3" />

        <div className="w-full flex items-center justify-between px-1 sm:px-2">
          <button
            onClick={handleClose}
            aria-label="Close now playing sheet"
            className="min-w-[40px] sm:min-w-[44px] min-h-[40px] sm:min-h-[44px] shrink-0 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-[#F4F4F2] transition cursor-pointer"
          >
            <ChevronDown className="w-6 h-6" />
          </button>

          <div className="text-center min-w-0 flex-1 px-1 sm:px-2">
            <span className="meta-label text-[10px] text-[#1ED760] tracking-widest flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1ED760] animate-pulse" />
              NOW PLAYING
            </span>
            <p className="text-xs text-[#8A8A8E] truncate max-w-[200px] mx-auto">
              {showQueue ? 'Upcoming Queue' : (currentTrack.artist || 'Super Culture')}
            </p>
          </div>

          <button
            onClick={() => setShowQueue((prev) => !prev)}
            aria-label={showQueue ? 'Show album artwork' : 'Show track queue'}
            className={`min-w-[40px] sm:min-w-[44px] min-h-[40px] sm:min-h-[44px] shrink-0 rounded-full flex items-center justify-center transition cursor-pointer ${
              showQueue
                ? 'bg-[#1ED760] text-[#0B0B0C] font-semibold'
                : 'bg-white/5 hover:bg-white/10 text-[#F4F4F2]'
            }`}
          >
            <ListMusic className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. Main Middle Canvas (Album Art or Queue List) */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 w-full max-w-md mx-auto overflow-hidden">
        {showQueue ? (
          <div className="w-full h-full flex flex-col min-h-0 bg-white/[0.03] border border-white/10 rounded-3xl p-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <span className="meta-label text-[10px] text-[#F4F4F2]">UP NEXT IN QUEUE</span>
              <span className="text-[10px] text-[#8A8A8E] font-mono">{queue?.length || 0} tracks</span>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mt-3 min-h-0">
              {queue && queue.length > 0 ? (
                queue.map((track, idx) => {
                  const isCurrent =
                    track.id === currentTrack.id ||
                    (track.videoId && track.videoId === currentTrack.videoId);
                  return (
                    <div
                      key={`${track.videoId || track.id}_${idx}`}
                      onClick={() => {
                        onSelectTrack(track);
                        setShowQueue(false);
                      }}
                      className={`min-h-[48px] p-2.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition ${
                        isCurrent
                          ? 'bg-[#1ED760]/15 border border-[#1ED760]/30'
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CoverImage
                          src={track.cover || track.thumbnailUrl}
                          alt=""
                          className="w-10 h-10 rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-[#1ED760]' : 'text-[#F4F4F2]'}`}>
                            {track.title}
                          </p>
                          <p className="text-[11px] text-[#8A8A8E] truncate">{track.artist}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[#8A8A8E] shrink-0">
                        {track.duration || formatTime(track.seconds || 0)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-[#8A8A8E]">
                  No upcoming tracks in queue
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center justify-center">
            {/* Artwork Container */}
            <div className="w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 max-w-[72vw] max-h-[38vh] aspect-square rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 shadow-2xl relative mb-4 sm:mb-6 shrink-0">
              <CoverImage
                src={currentTrack.cover}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
                iconSize="w-12 h-12"
              />
            </div>

            {/* Track Info & Like Action */}
            <div className="w-full flex items-center justify-between gap-2 sm:gap-3 mb-2 px-1 sm:px-2">
              <div className="min-w-0 flex-1 pr-1">
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-[#F4F4F2] truncate select-text">
                  {currentTrack.title}
                </h2>
                <p className="text-xs sm:text-sm text-[#8A8A8E] truncate select-text mt-0.5">
                  {currentTrack.artist}
                </p>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={onToggleLike}
                  aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                  className={`min-w-[36px] sm:min-w-[44px] min-h-[36px] sm:min-h-[44px] shrink-0 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 ${
                    isLiked
                      ? 'bg-[#1ED760]/20 text-[#1ED760] border border-[#1ED760]/40'
                      : 'bg-white/5 text-[#8A8A8E] hover:text-white border border-white/10'
                  }`}
                >
                  <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${isLiked ? 'fill-current' : ''}`} />
                </button>

                <button
                  onClick={onAddToPlaylist}
                  aria-label="Add track to playlist"
                  className="min-w-[36px] sm:min-w-[44px] min-h-[36px] sm:min-h-[44px] shrink-0 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-[#8A8A8E] hover:text-white transition cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom Controls: Scrubber & Transport Buttons */}
      <div className="w-full max-w-md mx-auto px-4 pb-2 shrink-0">
        {/* Scrubber Seek Bar (44px touch area for effortless finger sliding) */}
        <div
          ref={progressBarRef}
          onClick={handleSeekTouch}
          onTouchStart={handleSeekTouch}
          onTouchMove={handleSeekTouch}
          className="w-full h-11 flex flex-col justify-center cursor-pointer group"
        >
          <div className="w-full h-2 rounded-full bg-white/10 relative overflow-hidden">
            <div
              className="h-full bg-[#1ED760] rounded-full transition-all duration-75 relative"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="w-full flex items-center justify-between text-[11px] font-mono text-[#8A8A8E] mt-1.5 px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Primary Controls Row: Shuffle, Prev, Play/Pause, Next, Repeat */}
        <div className="flex items-center justify-between w-full mt-1.5 sm:mt-2 gap-1 sm:gap-2">
          {/* Shuffle */}
          <button
            onClick={onToggleShuffle}
            aria-label="Toggle shuffle"
            className={`min-w-[36px] sm:min-w-[44px] min-h-[36px] sm:min-h-[44px] shrink-0 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 ${
              isShuffle
                ? 'text-[#1ED760]'
                : 'text-[#8A8A8E] hover:text-white'
            }`}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Skip Previous */}
          <button
            onClick={onSkipPrev}
            aria-label="Previous track"
            className="min-w-[40px] sm:min-w-[48px] min-h-[40px] sm:min-h-[48px] shrink-0 rounded-full flex items-center justify-center transition text-[#F4F4F2] hover:scale-105 active:scale-95 cursor-pointer"
          >
            <SkipBack className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
          </button>

          {/* Master Play / Pause */}
          {isAutoplayBlocked ? (
            <button
              onClick={onTogglePlay}
              aria-label="Tap to play audio stream"
              className="min-h-[44px] sm:min-h-[48px] px-4 sm:px-5 shrink-0 rounded-full bg-[#1ED760] text-[#0B0B0C] text-xs font-bold flex items-center gap-2 shadow-xl shadow-[#1ED760]/30 transition animate-pulse active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>TAP TO PLAY</span>
            </button>
          ) : (
            <button
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full flex items-center justify-center shadow-2xl transition bg-[#F4F4F2] text-[#0B0B0C] hover:scale-105 active:scale-95 cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
              ) : (
                <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5" />
              )}
            </button>
          )}

          {/* Skip Next */}
          <button
            onClick={onSkipNext}
            aria-label="Next track"
            className="min-w-[40px] sm:min-w-[48px] min-h-[40px] sm:min-h-[48px] shrink-0 rounded-full flex items-center justify-center transition text-[#F4F4F2] hover:scale-105 active:scale-95 cursor-pointer"
          >
            <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
          </button>

          {/* Repeat */}
          <button
            onClick={onToggleRepeat}
            aria-label={
              repeatMode === 'one'
                ? 'Repeat current track (1)'
                : repeatMode === 'all'
                ? 'Repeat all tracks'
                : 'Repeat off'
            }
            title={
              repeatMode === 'one'
                ? 'Repeat: Current Track (1)'
                : repeatMode === 'all'
                ? 'Repeat: All Tracks'
                : 'Repeat: Off'
            }
            className={`min-w-[36px] sm:min-w-[44px] min-h-[36px] sm:min-h-[44px] shrink-0 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 relative ${
              isRepeat || repeatMode !== 'off'
                ? 'text-[#1ED760]'
                : 'text-[#8A8A8E] hover:text-white'
            }`}
          >
            <Repeat className="w-5 h-5" />
            {repeatMode === 'one' && (
              <span className="absolute top-1 right-1 text-[9px] font-bold bg-[#1ED760] text-[#09090b] rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                1
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
