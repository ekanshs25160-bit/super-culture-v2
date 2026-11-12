import React from 'react';
import { Volume2, Shuffle, Repeat, Plus } from 'lucide-react';

export default function PlayerTray({
  isOpen,
  trayRef,
  isShuffle,
  isRepeat,
  repeatMode = 'off',
  volumePct,
  onToggleShuffle,
  onToggleRepeat,
  onVolumeClick,
  onAddToPlaylist,
}) {
  if (!isOpen) return null;

  return (
    <div
      ref={trayRef}
      className="absolute bottom-full right-5 mb-2 p-3 rounded-2xl bg-[#121215]/95 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center gap-3.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div className="flex items-center gap-2">
        <Volume2 className="w-4 h-4 text-[#8A8A8E] shrink-0" />
        <div
          onClick={onVolumeClick}
          aria-label="Adjust audio volume"
          className="sc-oled-track w-20 h-2 rounded-full p-[2px] overflow-hidden cursor-pointer flex items-center"
        >
          <div className="h-full bg-[#F4F4F2] rounded-full transition-all" style={{ width: `${volumePct}%` }} />
        </div>
      </div>
      <div className="h-4 w-px bg-white/10" />
      <button
        onClick={onToggleShuffle}
        aria-label="Toggle shuffle"
        className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition cursor-pointer ${isShuffle ? 'text-[#1ED760]' : 'text-[#8A8A8E]'}`}
      >
        <Shuffle className="w-4 h-4" />
      </button>
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
        className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition cursor-pointer relative ${isRepeat || repeatMode !== 'off' ? 'text-[#1ED760]' : 'text-[#8A8A8E]'}`}
      >
        <Repeat className="w-4 h-4" />
        {repeatMode === 'one' && (
          <span className="absolute top-1 right-1 text-[8px] font-bold bg-[#1ED760] text-[#09090b] rounded-full w-3 h-3 flex items-center justify-center leading-none">
            1
          </span>
        )}
      </button>
      <button
        onClick={onAddToPlaylist}
        aria-label="Add track to playlist"
        className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#8A8A8E] hover:text-white transition cursor-pointer"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

