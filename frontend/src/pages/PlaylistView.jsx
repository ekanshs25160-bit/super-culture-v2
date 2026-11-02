import React from 'react';
import { useParams } from 'react-router-dom';
import { Play, Shuffle } from 'lucide-react';
import { PageHeader, TrackRow, CoverStack, EmptyState } from '../components/shared';
import { useAudio } from '../hooks/useAudio';
import { useLibraryStore } from '../store/useLibraryStore';
import { INITIAL_TRACK_QUEUE, TRENDING_TRACKS, LIBRARY_TRACKS } from '../data/tracks';

export default function PlaylistView() {
  const { playlistId } = useParams();
  const { playTrack, toggleShuffle, showToast } = useAudio();
  const { likedSongs, playlists: storePlaylists } = useLibraryStore();

  const isLikedSongs = playlistId === 'liked-songs';
  const customPlaylist = storePlaylists.find((p) => p.id === playlistId);

  let title = 'Curated Playlist';
  let description = 'Editorial sound selection curated for high-fidelity personal listening.';
  let tracks = [...INITIAL_TRACK_QUEUE, ...TRENDING_TRACKS];
  let covers = [];

  if (isLikedSongs) {
    title = 'Liked Songs Archive';
    description = 'All your saved tracks, synchronized directly with your personal guest session.';
    tracks = likedSongs.length > 0
      ? likedSongs.map((s) => ({
          ...s,
          id: s.videoId || s.id,
          videoId: s.videoId || s.id,
          cover: s.cover || s.thumbnailUrl || s.thumbnail_url || LIBRARY_TRACKS.likedSongs.cover,
          duration: s.durationFormatted || (typeof s.duration === 'number' ? `${Math.floor(s.duration / 60)}:${s.duration % 60 < 10 ? '0' : ''}${s.duration % 60}` : '3:45'),
          seconds: typeof s.duration === 'number' ? s.duration : 225,
        }))
      : [LIBRARY_TRACKS.likedSongs];
    covers = tracks.map((t) => t.cover).filter(Boolean);
  } else if (customPlaylist) {
    title = customPlaylist.name || customPlaylist.title;
    description = customPlaylist.description || 'Custom playlist created on Super Culture.';
    tracks = customPlaylist.tracks?.length > 0 ? customPlaylist.tracks : [...INITIAL_TRACK_QUEUE];
    covers = [customPlaylist.coverUrl || LIBRARY_TRACKS.tapeArchive.cover];
  } else if (playlistId) {
    title = playlistId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    covers = tracks.map((t) => t.cover).filter(Boolean);
  }

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
      showToast(`Playing ${title}`);
    }
  };

  const handleShufflePlay = () => {
    if (tracks.length > 0) {
      toggleShuffle();
      const randomIndex = Math.floor(Math.random() * tracks.length);
      playTrack(tracks[randomIndex], tracks);
      showToast(`Shuffling ${title}`);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto no-scrollbar px-2 py-1 pb-24">
      <PageHeader
        title={title}
        backTo="/library"
        backLabel="Library"
        meta={`${tracks.length} TRACKS`}
      />

      {/* Playlist Hero Header Banner */}
      <div className="sc-card p-5 mb-5 rounded-2xl flex flex-col sm:flex-row items-center sm:items-end gap-5">
        <CoverStack covers={covers} />

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <span className="meta-label text-[10px] text-[#1ED760] mb-1.5 block">
            {isLikedSongs ? 'PINNED VAULT' : 'PLAYLIST ARCHIVE'}
          </span>
          <h2 className="font-serif italic text-2xl sm:text-3xl font-semibold text-[#F4F4F2] tracking-tight mb-1 truncate">
            {title}
          </h2>
          <p className="text-xs text-[#8A8A8E] line-clamp-2 mb-4 max-w-xl">
            {description}
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <button
              onClick={handlePlayAll}
              aria-label={`Play all tracks in ${title}`}
              className="sc-pill px-4 py-2 bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C] font-semibold text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
              <span>Play All</span>
            </button>

            <button
              onClick={handleShufflePlay}
              aria-label={`Shuffle play ${title}`}
              className="sc-pill px-4 py-2 bg-white/10 hover:bg-white/20 text-[#F4F4F2] text-xs font-medium flex items-center gap-2 transition cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Shuffle</span>
            </button>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="space-y-2">
        {tracks.length > 0 ? (
          tracks.map((t, idx) => (
            <TrackRow key={t.id + idx} track={t} index={idx} queue={tracks} />
          ))
        ) : (
          <EmptyState
            title="No Tracks In This Playlist"
            description="Add tracks to this playlist from Search or your player controls."
          />
        )}
      </div>
    </div>
  );
}
