import React from 'react';
import { Play } from 'lucide-react';
import CoverImage from '../shared/CoverImage';

/**
 * TopResultCard
 * Featured prominent top result card in Search layout with large album sleeve,
 * 2-line wrapped editorial title, artist tag, and play button.
 */
export default function TopResultCard({ track, onPlay }) {
  if (!track) return null;

  return (
    <div className="lg:col-span-5 flex flex-col">
      <span className="meta-label text-[#8A8A8E] mb-2">TOP RESULT</span>
      <div
        onClick={() => onPlay(track)}
        className="sc-card-secondary p-5 rounded-2xl flex flex-col justify-between flex-1 group cursor-pointer relative overflow-hidden transition hover:border-white/20"
      >
        <div className="flex flex-col gap-3">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-white/15 shadow-xl bg-black/40">
            <CoverImage
              src={track.cover}
              alt=""
              iconSize="w-8 h-8"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          </div>
          <div>
            <h3 className="font-serif italic text-xl sm:text-2xl text-[#F4F4F2] leading-tight line-clamp-2">
              {track.title}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-[#8A8A8E]">{track.artist}</span>
              <span className="meta-label text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-[#F4F4F2]">
                SONG
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
          <span className="text-xs font-mono text-[#8A8A8E]">{track.duration}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(track);
            }}
            aria-label={`Play ${track.title}`}
            className="w-11 h-11 rounded-full bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C] flex items-center justify-center shadow-[0_0_20px_rgba(30,215,96,0.4)] group-hover:scale-105 transition cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

