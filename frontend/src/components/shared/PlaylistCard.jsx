import React from 'react';
import { Play } from 'lucide-react';

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
        <img
          src={cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop'}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
        />
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
