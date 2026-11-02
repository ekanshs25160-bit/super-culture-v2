import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

/**
 * ArtistCard
 * Distinct vertical glassmorphic card for artist search results.
 * Features a circular avatar with green hover glow, bold serif typography,
 * and a frosted "View Artist" action pill.
 */
export default function ArtistCard({ artist }) {
  const navigate = useNavigate();
  const [imgFailed, setImgFailed] = useState(false);

  if (!artist || !artist.name) return null;

  const handleClick = () => {
    navigate(`/artist/${encodeURIComponent(artist.name)}`, {
      state: {
        avatar: artist.avatar,
        genre: artist.role || artist.subscribers || 'Artist',
      },
    });
  };

  const initial = (artist.name || 'A').charAt(0).toUpperCase();

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`View artist profile for ${artist.name}`}
      className="sc-card group flex flex-col items-center text-center p-4 rounded-2xl w-44 shrink-0 cursor-pointer transition-all duration-300 hover:border-[#1ED760]/40 hover:shadow-[0_0_24px_rgba(30,215,96,0.18)] select-none"
    >
      {/* Circular Avatar Container with Hover Glow */}
      <div className="relative mb-3">
        <div
          className="absolute inset-0 rounded-full bg-[#1ED760]/0 group-hover:bg-[#1ED760]/20 blur-md transition duration-300 pointer-events-none"
          aria-hidden="true"
        />
        {artist.avatar && !imgFailed ? (
          <img
            src={artist.avatar}
            alt={artist.name}
            onError={() => setImgFailed(true)}
            className="aspect-square rounded-full object-cover w-24 h-24 mx-auto shadow-lg border border-white/10 group-hover:scale-105 group-hover:border-[#1ED760]/50 transition-all duration-300 relative z-10"
          />
        ) : (
          <div
            className="aspect-square rounded-full w-24 h-24 mx-auto shadow-lg border border-white/10 bg-[#17171A] flex items-center justify-center font-serif text-2xl font-bold text-[#1ED760] group-hover:scale-105 group-hover:border-[#1ED760]/50 transition-all duration-300 relative z-10"
            aria-hidden="true"
          >
            {initial}
          </div>
        )}
      </div>

      {/* Artist Name */}
      <h3 className="font-serif text-lg font-bold text-[#F4F4F2] truncate max-w-full group-hover:text-[#1ED760] transition-colors">
        {artist.name}
      </h3>

      {/* Subtitle / Role / Subscribers */}
      <p className="text-[11px] text-[#8A8A8E] truncate max-w-full mb-3 mt-0.5">
        {artist.subscribers || artist.role || 'Artist'}
      </p>

      {/* Frosted "View Artist" Pill */}
      <span className="sc-pill text-[10px] px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[#F4F4F2] group-hover:border-[#1ED760]/40 group-hover:text-[#1ED760] flex items-center gap-1 transition">
        <span>View Artist</span>
        <ArrowUpRight className="w-3 h-3 text-[#1ED760]" aria-hidden="true" />
      </span>
    </div>
  );
}

