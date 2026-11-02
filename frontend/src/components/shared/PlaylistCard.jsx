import React from 'react';
import { Play, Heart } from 'lucide-react';
import CoverImage from './CoverImage';

/**
 * Reusable PlaylistCard component for Library vault, Search results & Discovery grids.
 * Provides accessible button click areas, responsive layout and hover transitions.
 */
export default function PlaylistCard({
  title,
  subtitle,
  cover,
  tag,
  onClick,
  onPlay,
  isLikedSongs = false,
}) {
  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay();
    }
  };

  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={`Open playlist ${title}`}
      className="sc-card sc-card-hover p-3.5 rounded-2xl flex flex-col justify-between group cursor-pointer transition select-none"
    >
      {/* Square Cover Art with Play Button Hover */}
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 border border-white/10 bg-black/40">
        {isLikedSongs ? (
          <div className="w-full h-full bg-[#17171A] flex items-center justify-center">
            <Heart className="w-12 h-12 text-[#1ED760] fill-current" aria-hidden="true" />
          </div>
        ) : (
          <CoverImage
            src={cover}
            alt=""
            iconSize="w-8 h-8"
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-end justify-end p-2.5">
          <button
            onClick={handlePlayClick}
            aria-label={`Play ${title}`}
            className="w-10 h-10 rounded-full bg-[#1ED760] text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Meta Labels & Titles */}
      <div className="min-w-0">
        {tag && (
          <span className="meta-label text-[9px] text-[#1ED760] block tracking-wider mb-1">
            {tag}
          </span>
        )}
        <h3 className="text-sm font-semibold text-[#F4F4F2] group-hover:text-[#1ED760] transition truncate">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[#8A8A8E] truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </article>
  );
}
