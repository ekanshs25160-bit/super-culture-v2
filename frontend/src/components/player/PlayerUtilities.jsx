import React from 'react';
import { Mic2, Laptop2, Volume2, ListMusic } from 'lucide-react';

export default function PlayerUtilities({
  isEmptyPlayer,
  nextTrack,
  volumeTrackRef,
  volumePct,
  onToggleEmptyPlayer,
  onNextClick,
  onVolumeClick,
  onShowToast,
}) {
  return (
    <div className="flex items-center justify-end gap-2.5 w-full md:w-[30%]">
      {/* Toggle Button for Empty Player State Preview */}
      <button
        id="btn-empty-player"
        onClick={onToggleEmptyPlayer}
        aria-label="Preview player empty state variant"
        className="meta-label text-[9px] px-2.5 py-1 rounded-full bg-black/85 hover:bg-black/95 border border-white/14 text-[#8A8A8E] hover:text-white transition hidden xl:inline-block cursor-pointer shadow-sm"
      >
        {isEmptyPlayer ? 'ACTIVE STATE' : 'EMPTY STATE'}
      </button>

      {/* "PLAYING NEXT" Dark OLED Frosted Pill */}
      <div
        onClick={onNextClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onNextClick();
        }}
        aria-label={`Play next track ${nextTrack?.title || 'Up next'}`}
        className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-2xl bg-black/90 hover:bg-black/98 border border-white/14 hover:border-white/28 shadow-[0_4px_16px_rgba(0,0,0,0.85)] cursor-pointer transition max-w-[185px] select-none"
      >
        <img
          id="next-track-cover"
          src={nextTrack?.cover || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=100&q=80'}
          alt="Playing Next"
          className="w-7 h-7 rounded-lg object-cover shrink-0"
        />
        <div className="min-w-0 flex-1">
          <span className="meta-label text-[8px] text-[#1ED760] block">PLAYING NEXT</span>
          <p id="next-track-title" className="text-[11px] font-medium text-[#F4F4F2] truncate">
            {nextTrack?.title || 'Veridis Quo'}
          </p>
        </div>
        <ListMusic className="w-3.5 h-3.5 text-[#8A8A8E] shrink-0" aria-hidden="true" />
      </div>

      {/* Utility Icons + Volume Slider */}
      <div className="flex items-center gap-2 text-[#8A8A8E]">
        {/* Lyrics Icon */}
        <button
          onClick={() => onShowToast('Time-synced Editorial Lyrics Active')}
          aria-label="View synchronized lyrics"
          className="hover:text-[#F4F4F2] transition p-1 cursor-pointer"
        >
          <Mic2 className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Connect Devices Icon */}
        <button
          onClick={() => onShowToast('Connected: Teenage Engineering OB-4 Studio')}
          aria-label="Connect audio output device"
          className="hover:text-[#F4F4F2] transition p-1 cursor-pointer"
        >
          <Laptop2 className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Speaker + Dark OLED Volume Slider */}
        <div className="hidden sm:flex items-center gap-1.5">
          <Volume2 className="w-4 h-4 text-[#F4F4F2]/80 shrink-0" aria-hidden="true" />
          <div
            ref={volumeTrackRef}
            onClick={onVolumeClick}
            aria-label="Adjust audio volume"
            className="sc-oled-track w-18 h-2 rounded-full p-[2px] overflow-hidden cursor-pointer flex items-center"
          >
            <div
              id="volume-fill"
              className="h-full bg-[#F4F4F2] rounded-full transition-all shadow-[0_0_6px_rgba(255,255,255,0.6)]"
              style={{ width: `${volumePct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

