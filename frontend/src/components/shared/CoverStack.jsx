import React from 'react';

/**
 * CoverStack renders a stylized overlapping deck of album sleeves
 * used in Editorial headers, Playlist previews, and Discovery stacks.
 */
export default function CoverStack({ covers = [], className = '' }) {
  const defaultCovers = [
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80',
  ];

  const displayCovers = covers.length > 0 ? covers.slice(0, 3) : defaultCovers;

  return (
    <div className={`relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 ${className}`}>
      {displayCovers.length > 2 && (
        <div className="absolute inset-0 translate-x-2 -translate-y-1.5 rotate-6 rounded-2xl overflow-hidden border border-white/10 shadow-lg opacity-40">
          <img src={displayCovers[2]} alt="Cover layer 3" className="w-full h-full object-cover" />
        </div>
      )}
      {displayCovers.length > 1 && (
        <div className="absolute inset-0 translate-x-1 -translate-y-0.5 rotate-3 rounded-2xl overflow-hidden border border-white/15 shadow-xl opacity-70">
          <img src={displayCovers[1]} alt="Cover layer 2" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black/60">
        <img src={displayCovers[0]} alt="Primary album cover" className="w-full h-full object-cover" />
      </div>
    </div>
  );
}

