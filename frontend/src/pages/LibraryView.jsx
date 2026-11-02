import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader, PlaylistCard, Skeleton } from '../components/shared';
import { useAudio } from '../hooks/useAudio';
import { useLibraryStore } from '../store/useLibraryStore';
import { LIBRARY_TRACKS, INITIAL_TRACK_QUEUE } from '../data/tracks';

export default function LibraryView() {
  const navigate = useNavigate();
  const { playTrack } = useAudio();
  const { likedCount, playlists: storePlaylists, likedSongs, loading, createPlaylist } = useLibraryStore();

  const handleCreateNew = async () => {
    const defaultName = `My Playlist #${storePlaylists.length + 1}`;
    const name = window.prompt ? window.prompt('Name your new playlist:', defaultName) : defaultName;
    if (name && name.trim()) {
      const created = await createPlaylist(name.trim());
      if (created) {
        navigate(`/library/${created.id}`);
      }
    }
  };

  const customPlaylists = storePlaylists
    .filter((p) => p.id !== '35mm-night-archive')
    .map((p) => ({
      id: p.id,
      title: p.name || p.title,
      subtitle: p.description || 'Playlist • Custom Archive',
      cover: p.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
      tag: 'USER VAULT',
      track: {
        id: p.id,
        videoId: 'MV_3Dpw-BRY',
        title: p.name || p.title,
        artist: 'Personal Archive',
        cover: p.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
        duration: '3:45',
        seconds: 225,
      },
    }));

  const allPlaylists = [
    {
      id: 'liked-songs',
      title: 'Liked Songs Archive',
      subtitle: `${likedCount} Curated Tracks`,
      cover: likedSongs[0]?.cover || likedSongs[0]?.thumbnailUrl || LIBRARY_TRACKS.likedSongs.cover,
      tag: 'PINNED PLAYLIST',
      track: likedSongs[0] || LIBRARY_TRACKS.likedSongs,
    },
    {
      id: '35mm-night-archive',
      title: '35mm Night Archive',
      subtitle: 'Playlist • Sora • 42 tracks',
      cover: LIBRARY_TRACKS.tapeArchive.cover,
      tag: 'EDITORIAL',
      track: LIBRARY_TRACKS.tapeArchive,
    },
    {
      id: 'tokyo-electronic',
      title: 'Tokyo Minimal Synthetics',
      subtitle: 'Playlist • 28 tracks',
      cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
      tag: 'CURATED',
      track: INITIAL_TRACK_QUEUE[0],
    },
    ...customPlaylists,
  ];

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
              onClick={() => navigate(`/library/${pl.id}`)}
              onPlay={() => playTrack(pl.track)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
