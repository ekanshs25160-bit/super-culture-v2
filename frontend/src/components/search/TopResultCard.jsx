import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, User } from 'lucide-react';
import CoverImage from '../shared/CoverImage';

/**
 * TopResultCard
 * Featured prominent top result card in Search layout with large album sleeve,
 * 2-line wrapped editorial title, artist tag, direct link to Artist Profile, and play button.
 */
export default function TopResultCard({ track, onPlay, query = '' }) {
  const navigate = useNavigate();
  if (!track) return null;

  const isArtistMatch = Boolean(
    query &&
    query.trim().length > 1 &&
    track.artist?.toLowerCase().includes(query.trim().toLowerCase())
  );

  const handleArtistClick = (e) => {
    e?.stopPropagation?.();
    if (track.artist) {
      navigate(`/artist/${encodeURIComponent(track.artist)}`);
    }
  };

  return (
    <div className="lg:col-span-5 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="meta-label text-[#8A8A8E]">TOP RESULT</span>
        {track.artist && (
          <button
            onClick={handleArtistClick}
            aria-label={`View artist profile for ${track.artist}`}
            className="meta-label text-[9px] text-[#1ED760] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <User className="w-2.5 h-2.5" />
            <span>VIEW ARTIST</span>
          </button>
        )}
      </div>

      <div
        onClick={() => {
          if (isArtistMatch) {
            handleArtistClick();
          } else {
            onPlay(track);
          }
        }}
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
              <span
                onClick={handleArtistClick}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleArtistClick(e);
                }}
                className="text-xs text-[#8A8A8E] hover:underline hover:text-[#1ED760] transition cursor-pointer"
              >
                {track.artist}
              </span>
              <span className="meta-label text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-[#F4F4F2]">
                {isArtistMatch ? 'ARTIST HIT' : 'SONG'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
          <button
            onClick={handleArtistClick}
            aria-label={`View ${track.artist} profile`}
            className="sc-pill px-3 py-1 bg-white/5 hover:bg-white/15 text-[11px] text-[#F4F4F2] flex items-center gap-1.5 transition cursor-pointer"
          >
            <User className="w-3 h-3 text-[#1ED760]" />
            <span>Artist Profile</span>
          </button>

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
