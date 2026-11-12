import React from 'react';

export default function PlayerTransport({
  isPlaying,
  isEmptyPlayer,
  isAutoplayBlocked = false,
  isShuffle,
  isRepeat,
  repeatMode = 'off',
  currentSeconds,
  totalSeconds,
  progressPct,
  progressTrackRef,
  formatTime,
  onTogglePlay,
  onToggleShuffle,
  onToggleRepeat,
  onSkipPrev,
  onSkipNext,
  onSeekClick,
}) {
  return (
    <div className="flex flex-col items-center justify-center w-full md:w-[40%] max-w-[520px]">
      <div className="flex items-center gap-4 mb-1.5">
        {/* Shuffle (Desktop only; on mobile lives in tray/sheet) */}
        <button
          onClick={onToggleShuffle}
          aria-label="Toggle shuffle"
          title="Toggle shuffle"
          className={`hidden md:inline-flex min-w-[44px] min-h-[44px] rounded-full items-center justify-center transition cursor-pointer ${
            isShuffle
              ? 'text-[#1ED760] drop-shadow-[0_0_8px_rgba(30,215,96,0.6)]'
              : 'text-[#8A8A8E] hover:text-white'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
        </button>

        {/* Previous */}
        <button
          onClick={onSkipPrev}
          aria-label="Previous track"
          title="Previous track"
          className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition text-[#F4F4F2]/85 hover:text-white cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20L9 12l10-8v16zM5 19V5" />
          </svg>
        </button>

        {/* Play / Pause or Tap-to-play Button */}
        {isAutoplayBlocked ? (
          <button
            id="master-play-btn"
            onClick={onTogglePlay}
            aria-label="Tap to play audio"
            title="Tap to play audio"
            className="min-h-[44px] px-4 rounded-full bg-[#1ED760] text-[#0B0B0C] font-semibold text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(30,215,96,0.6)] transition hover:scale-105 active:scale-95 animate-pulse cursor-pointer"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>Tap to play</span>
          </button>
        ) : (
          <button
            id="master-play-btn"
            onClick={onTogglePlay}
            aria-label={isPlaying && !isEmptyPlayer ? 'Pause track' : 'Play track'}
            title={isPlaying && !isEmptyPlayer ? 'Pause track' : 'Play track'}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] transition bg-[#F4F4F2] text-[#0B0B0C] hover:scale-105 active:scale-95 cursor-pointer"
          >
            {isPlaying && !isEmptyPlayer ? (
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}

        {/* Next */}
        <button
          onClick={onSkipNext}
          aria-label="Next track"
          title="Next track"
          className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition text-[#F4F4F2]/85 hover:text-white cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 4l10 8-10 8V4zM19 5v14" />
          </svg>
        </button>

        {/* Repeat (Desktop only; on mobile lives in tray/sheet) */}
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
          className={`hidden md:inline-flex min-w-[44px] min-h-[44px] rounded-full items-center justify-center transition cursor-pointer relative ${
            isRepeat || repeatMode !== 'off'
              ? 'text-[#1ED760] drop-shadow-[0_0_8px_rgba(30,215,96,0.6)]'
              : 'text-[#8A8A8E] hover:text-white'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          {repeatMode === 'one' && (
            <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-[#1ED760] text-[#09090b] rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none shadow">
              1
            </span>
          )}
        </button>
      </div>

      {/* Dark OLED Seek Progress Bar & Timestamps */}
      <div className="w-full flex items-center gap-3">
        <span id="time-current" className="font-mono text-[10px] text-[#8A8A8E] w-7 text-right">
          {isEmptyPlayer ? '0:00' : formatTime(currentSeconds)}
        </span>
        <div
          ref={progressTrackRef}
          id="progress-track"
          onClick={onSeekClick}
          className="relative flex-1 h-11 flex items-center cursor-pointer group"
        >
          <div className="sc-oled-track w-full h-1.5 rounded-full overflow-hidden">
            <div
              id="progress-fill"
              className="h-full bg-[#1ED760] rounded-full transition-all duration-150 shadow-[0_0_10px_rgba(30,215,96,0.7)]"
              style={{ width: `${isEmptyPlayer ? 0 : progressPct}%` }}
            />
          </div>
          <div
            id="progress-thumb"
            className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] opacity-0 group-hover:opacity-100 transition absolute pointer-events-none"
            style={{ left: `calc(${isEmptyPlayer ? 0 : progressPct}% - 5px)` }}
          />
        </div>
        <span id="time-total" className="font-mono text-[10px] text-[#8A8A8E] w-7">
          {isEmptyPlayer ? '0:00' : formatTime(totalSeconds)}
        </span>
      </div>
    </div>
  );
}
