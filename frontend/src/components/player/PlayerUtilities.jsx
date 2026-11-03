import React from 'react';
import { Volume2, VolumeX, ListMusic } from 'lucide-react';
import CoverImage from '../shared/CoverImage';

export default function PlayerUtilities({
  nextTrack,
  volumeTrackRef,
  volumePct,
  onNextClick,
  onVolumeClick,
}) {
  return (
    <div className="flex items-center justify-end gap-2.5 w-auto md:w-[30%] shrink-0">
      {/* "PLAYING NEXT" Dark OLED Frosted Pill */}
      <div
        onClick={onNextClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onNextClick();
        }}
        aria-label={`Play next track ${nextTrack?.title || 'Up next'}`}
        className="hidden sm:flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-2xl bg-black/90 hover:bg-black/98 border border-white/14 hover:border-white/28 shadow-[0_4px_16px_rgba(0,0,0,0.85)] cursor-pointer transition max-w-[170px] select-none"
      >
        <CoverImage
          id="next-track-cover"
          src={nextTrack?.cover}
          alt=""
          iconSize="w-3.5 h-3.5"
          className="w-7 h-7 rounded-lg object-cover shrink-0"
        />
        <div className="min-w-0 flex-1">
          <span className="meta-label text-[8px] text-[#1ED760] block">UP NEXT</span>
          <p id="next-track-title" className="text-[11px] font-medium text-[#F4F4F2] truncate">
            {nextTrack?.title || 'Queue empty'}
          </p>
        </div>
        <ListMusic className="w-3.5 h-3.5 text-[#8A8A8E] shrink-0" aria-hidden="true" />
      </div>

      {/* Speaker + Dark OLED Volume Slider (Hidden on < md; accessible via popover tray) */}
      <div className="hidden md:flex items-center gap-1.5 text-[#8A8A8E]">
        {volumePct === 0 ? (
          <VolumeX className="w-4 h-4 text-[#8A8A8E] shrink-0" aria-hidden="true" />
        ) : (
          <Volume2 className="w-4 h-4 text-[#F4F4F2]/80 shrink-0" aria-hidden="true" />
        )}
        <div
          ref={volumeTrackRef}
          onClick={onVolumeClick}
          aria-label="Adjust audio volume"
          className="sc-oled-track w-16 lg:w-20 h-2 rounded-full p-[2px] overflow-hidden cursor-pointer flex items-center"
        >
          <div
            id="volume-fill"
            className="h-full bg-[#F4F4F2] rounded-full transition-all shadow-[0_0_6px_rgba(255,255,255,0.6)]"
            style={{ width: `${volumePct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
