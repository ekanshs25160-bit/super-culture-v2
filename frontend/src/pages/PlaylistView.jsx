import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Shuffle, Heart, Trash2, ArrowUpDown } from 'lucide-react';
import { PageHeader, TrackRow, CoverStack, EmptyState, ConfirmDialog } from '../components/shared';
import { useAudio } from '../hooks/useAudio';
import { useLibraryStore } from '../store/useLibraryStore';
import { normalizeTrackMetadata, sortPlaylistTracks } from '../utils/csvPlaylistParser';

export default function PlaylistView() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const { playTrack, toggleShuffle, showToast } = useAudio();
  const {
    likedSongs,
    playlists: storePlaylists,
    removeTrackFromPlaylist,
    updatePlaylistName,
    deletePlaylist,
  } = useLibraryStore();

  const isLikedSongs = playlistId === 'liked-songs';
  const customPlaylist = storePlaylists.find((p) => p.id === playlistId);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sortKey, setSortKey] = useState(() => {
    try {
      return localStorage.getItem(`sc_playlist_sort_${playlistId}`) || 'custom';
    } catch {
      return 'custom';
    }
  });

  const handleSortChange = (newKey) => {
    setSortKey(newKey);
    try {
      localStorage.setItem(`sc_playlist_sort_${playlistId}`, newKey);
    } catch {
      // ignore storage access restrictions
    }
  };

  let title = 'Playlist';
  let description = 'Personal playlist collection.';

  if (isLikedSongs) {
    title = 'Liked Songs';
    description = 'All your saved tracks, synchronized directly with your personal guest session.';
  } else if (customPlaylist) {
    title = customPlaylist.name || customPlaylist.title;
    description = customPlaylist.description || 'Custom playlist created on Super Culture.';
  } else if (playlistId) {
    title = playlistId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const rawTracks = useMemo(() => {
    if (isLikedSongs) {
      return likedSongs.map((s, idx) =>
        normalizeTrackMetadata(s, {
          addedAt: s.addedAt !== undefined ? s.addedAt : (1000000 + idx),
        })
      );
    }
    if (customPlaylist) {
      const list = Array.isArray(customPlaylist.tracks) ? customPlaylist.tracks : [];
      return list.map((t, idx) =>
        normalizeTrackMetadata(t, {
          addedAt: t.addedAt !== undefined ? t.addedAt : (1000000 + idx),
        })
      );
    }
    return [];
  }, [isLikedSongs, likedSongs, customPlaylist]);

  const covers = useMemo(() => {
    if (isLikedSongs) return rawTracks.map((t) => t.cover).filter(Boolean);
    if (customPlaylist) return [customPlaylist.coverUrl].filter(Boolean);
    return [];
  }, [isLikedSongs, rawTracks, customPlaylist]);

  const sortedTracks = useMemo(() => {
    return sortPlaylistTracks(rawTracks, sortKey);
  }, [rawTracks, sortKey]);

  const handlePlayAll = () => {
    if (sortedTracks.length > 0) {
      playTrack(sortedTracks[0], sortedTracks);
      showToast(`Playing ${title}`);
    } else {
      showToast('No tracks in this playlist yet');
    }
  };

  const handleShufflePlay = () => {
    if (sortedTracks.length > 0) {
      toggleShuffle();
      const randomIndex = Math.floor(Math.random() * sortedTracks.length);
      playTrack(sortedTracks[randomIndex], sortedTracks);
      showToast(`Shuffling ${title}`);
    } else {
      showToast('No tracks in this playlist yet');
    }
  };

  const handleRemoveTrack = (track) => {
    if (!customPlaylist) return;
    const res = removeTrackFromPlaylist(customPlaylist.id, track.videoId || track.id);
    if (res.removed) {
      showToast(`Removed "${track.title}" from ${res.playlistName}`);
    }
  };

  const handleNameSave = () => {
    if (customPlaylist && editName.trim() && editName.trim() !== customPlaylist.name) {
      updatePlaylistName(customPlaylist.id, editName.trim());
      showToast(`Renamed playlist to "${editName.trim()}"`);
    }
    setIsEditing(false);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto no-scrollbar px-2 py-1 pb-24">
      <PageHeader
        title={title}
        backTo="/library"
        backLabel="Library"
        meta={`${sortedTracks.length} TRACKS`}
      />

      {/* Playlist Hero Header Banner */}
      <div className="sc-card p-5 mb-5 rounded-2xl flex flex-col sm:flex-row items-center sm:items-end gap-5">
        {isLikedSongs ? (
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#17171A] border border-white/10 flex items-center justify-center shadow-2xl shrink-0">
            <Heart className="w-10 h-10 sm:w-12 sm:h-12 text-[#1ED760] fill-current" aria-hidden="true" />
          </div>
        ) : (
          <CoverStack covers={covers} />
        )}

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <span className="meta-label text-[10px] text-[#1ED760] mb-1.5 block">
            {isLikedSongs ? 'PINNED VAULT' : 'PLAYLIST ARCHIVE'}
          </span>
          {customPlaylist && isEditing ? (
            <input
              type="text"
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') {
                  setEditName(customPlaylist.name);
                  setIsEditing(false);
                }
              }}
              className="bg-black/50 border border-white/20 text-2xl sm:text-3xl font-serif text-white px-3 py-1 rounded-lg outline-none focus:border-[#1ED760] mb-1 w-full max-w-md"
            />
          ) : (
            <h2
              onClick={() => {
                if (customPlaylist) {
                  setEditName(customPlaylist.name || title);
                  setIsEditing(true);
                }
              }}
              className={`font-serif italic text-2xl sm:text-3xl font-semibold text-[#F4F4F2] tracking-tight mb-1 truncate ${
                customPlaylist ? 'cursor-pointer hover:text-[#1ED760] transition-colors' : ''
              }`}
              title={customPlaylist ? 'Click to rename' : undefined}
            >
              {title}
            </h2>
          )}
          <p className="text-xs text-[#8A8A8E] line-clamp-2 mb-4 max-w-xl">
            {description}
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-2.5">
            <button
              onClick={handlePlayAll}
              disabled={sortedTracks.length === 0}
              aria-label={`Play all tracks in ${title}`}
              className="sc-pill min-h-[36px] sm:min-h-[40px] px-4 py-2 bg-[#1ED760] hover:bg-[#22e868] disabled:opacity-40 text-[#0B0B0C] font-semibold text-xs flex items-center gap-2 transition cursor-pointer shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
              <span>Play All</span>
            </button>

            <button
              onClick={handleShufflePlay}
              disabled={sortedTracks.length === 0}
              aria-label={`Shuffle play ${title}`}
              className="sc-pill min-h-[36px] sm:min-h-[40px] px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-[#F4F4F2] text-xs font-medium flex items-center gap-2 transition cursor-pointer shrink-0"
            >
              <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Shuffle</span>
            </button>

            {/* Sort Selector Dropdown */}
            <div className="flex items-center gap-1.5 shrink-0 bg-white/10 hover:bg-white/15 border border-white/15 rounded-full px-3 py-1.5 min-h-[36px] sm:min-h-[40px] text-xs text-[#F4F4F2] transition">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#1ED760] shrink-0" aria-hidden="true" />
              <label htmlFor="playlist-sort-select" className="sr-only">Sort tracks</label>
              <select
                id="playlist-sort-select"
                value={sortKey}
                onChange={(e) => handleSortChange(e.target.value)}
                aria-label="Sort playlist tracks"
                className="bg-transparent text-xs text-[#F4F4F2] font-medium outline-none cursor-pointer pr-1"
              >
                <option value="custom" className="bg-[#121215] text-[#F4F4F2]">Playlist Order</option>
                <option value="date_desc" className="bg-[#121215] text-[#F4F4F2]">Date Added (Newest)</option>
                <option value="date_asc" className="bg-[#121215] text-[#F4F4F2]">Date Added (Oldest)</option>
                <option value="title_asc" className="bg-[#121215] text-[#F4F4F2]">Title (A–Z)</option>
                <option value="artist_asc" className="bg-[#121215] text-[#F4F4F2]">Artist (A–Z)</option>
                <option value="duration_asc" className="bg-[#121215] text-[#F4F4F2]">Duration (Shortest)</option>
              </select>
            </div>

            {!isLikedSongs && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                aria-label={`Delete ${title}`}
                className="sc-pill min-h-[36px] sm:min-h-[40px] px-3.5 py-2 bg-white/10 hover:bg-[#FF5A5F]/20 text-[#8A8A8E] hover:text-[#FF5A5F] border border-white/20 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Playlist Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Playlist"
        message={`Are you sure you want to delete "${title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          const ok = await deletePlaylist(playlistId);
          if (ok) {
            showToast('Playlist deleted');
            navigate('/library');
          } else {
            showToast('Failed to delete playlist');
          }
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Track List */}
      <div className="space-y-2">
        {sortedTracks.length > 0 ? (
          sortedTracks.map((t, idx) => (
            <TrackRow
              key={(t.id || t.videoId) + idx}
              track={t}
              index={idx}
              queue={sortedTracks}
              showRemove={Boolean(customPlaylist)}
              onRemove={handleRemoveTrack}
            />
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
