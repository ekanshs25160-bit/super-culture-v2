import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck } from 'lucide-react';
import { PageHeader, EmptyState, CoverImage } from '../components/shared';
import { useLibraryStore } from '../store/useLibraryStore';

export default function FollowedView() {
  const navigate = useNavigate();
  const followedArtists = useLibraryStore((s) => s.followedArtists);

  const handleArtistClick = (artist) => {
    navigate(`/artist/${encodeURIComponent(artist.name)}`, {
      state: { avatar: artist.avatar, genre: artist.genre },
    });
  };

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto no-scrollbar px-2 py-1 pb-24">
      <PageHeader
        title="Followed Artists"
        meta={`${followedArtists.length} ARTISTS`}
        subtitle="Subscribe to your favorite music producers, record labels, and sound artists."
      />

      {followedArtists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {followedArtists.map((artist) => (
            <div
              key={artist.id || artist.name}
              onClick={() => handleArtistClick(artist)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleArtistClick(artist);
              }}
              aria-label={`Open artist profile for ${artist.name}`}
              className="sc-card sc-card-hover p-4 rounded-2xl flex flex-col items-center text-center group cursor-pointer transition select-none"
            >
              <div className="relative w-20 h-20 rounded-full overflow-hidden mb-3 border border-white/15 bg-black/40 shadow-lg">
                <CoverImage
                  src={artist.avatar}
                  alt={artist.name}
                  iconSize="w-6 h-6"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
              </div>

              <h3 className="text-xs sm:text-sm font-semibold text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition max-w-full">
                {artist.name}
              </h3>
              <p className="text-[11px] text-[#8A8A8E] truncate max-w-full mt-0.5 mb-2.5">
                {artist.genre || 'Artist'}
              </p>

              <span className="sc-pill px-2.5 py-0.5 text-[10px] text-[#1ED760] bg-[#1ED760]/10 border border-[#1ED760]/30 flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                <span>Following</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No Followed Artists Yet"
          description="Follow music producers and sound artists to easily access their complete catalogs."
          actionLabel="Search Artists"
          onAction={() => navigate('/search')}
        />
      )}
    </div>
  );
}
