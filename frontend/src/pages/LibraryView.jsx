import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader, PlaylistCard, Skeleton } from '../components/shared';
import { useAudio } from '../hooks/useAudio';
import { useLibraryStore } from '../store/useLibraryStore';

export default function LibraryView() {
  const navigate = useNavigate();
  const { playTrack, showToast } = useAudio();
  const { likedCount, playlists: storePlaylists, likedSongs, loading, createPlaylist } = useLibraryStore();

  const handleCreateNew = async () => {
    const defaultName = `My Playlist #${storePlaylists.length + 1}`;
    const name = window.prompt ? window.prompt('Name your new playlist:', defaultName) : defaultName;
    if (name && name.trim()) {
      const created = await createPlaylist(name.trim());
      if (created) {
        showToast(`Created Playlist: ${created.name || name}`);
        navigate(`/library/${created.id}`);
      }
    }
  };

  const userPlaylists = storePlaylists.map((p) => ({
    id: p.id,
    title: p.name || p.title,
    subtitle: p.description || `${p.tracks?.length || 0} tracks`,
    cover: p.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
    tag: 'PLAYLIST',
    track: p.tracks?.[0] || null,
    tracks: p.tracks || [],
  }));

  const allPlaylists = [
    {
      id: 'liked-songs',
      title: 'Liked Songs Archive',
      subtitle: `${likedCount} Saved Tracks`,
      cover: likedSongs[0]?.cover || likedSongs[0]?.thumbnailUrl,
      tag: 'PINNED VAULT',
      track: likedSongs[0] || null,
      tracks: likedSongs,
    },
    ...userPlaylists,
  ];

  const handlePlayCard = (pl) => {
    if (pl.tracks && pl.tracks.length > 0) {
      playTrack(pl.tracks[0], pl.tracks);
    } else if (pl.track) {
      playTrack(pl.track);
    } else {
      showToast('No tracks in this playlist yet');
      navigate(`/library/${pl.id}`);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto no-scrollbar px-2 py-1 pb-24">
      <PageHeader
        title="Library"
        meta="PERSONAL VAULT"
        subtitle="Manage your saved music, curated archives, and personalized playlists."
      >
        <button
          onClick={handleCreateNew}
          aria-label="Create new playlist"
          className="sc-pill px-3.5 py-1.5 bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>New Playlist</span>
        </button>
      </PageHeader>

      {loading ? (
        <Skeleton.Grid count={6} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {allPlaylists.map((pl) => (
            <PlaylistCard
              key={pl.id}
              title={pl.title}
              subtitle={pl.subtitle}
              cover={pl.cover}
              tag={pl.tag}
              isLikedSongs={pl.id === 'liked-songs'}
              onClick={() => navigate(`/library/${pl.id}`)}
              onPlay={() => handlePlayCard(pl)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
