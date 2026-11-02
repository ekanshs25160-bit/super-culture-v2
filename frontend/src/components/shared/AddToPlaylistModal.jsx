import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Music, Check, FolderPlus } from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useUiStore } from '../../store/useUiStore';
import { useAudio } from '../../hooks/useAudio';
import CoverImage from './CoverImage';

/**
 * AddToPlaylistModal
 * Editorial glass modal allowing listeners to quickly save any song to an existing
 * playlist or create a new playlist on the fly.
 */
export default function AddToPlaylistModal({
  track: propTrack,
  isOpen: propIsOpen,
  onClose: propOnClose,
}) {
  const globalTrack = useUiStore((s) => s.addToPlaylistTrack);
  const closeGlobal = useUiStore((s) => s.closeAddToPlaylist);
  const { showToast } = useAudio();

  const playlists = useLibraryStore((s) => s.playlists);
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist);
  const createPlaylistWithTrack = useLibraryStore((s) => s.createPlaylistWithTrack);

  const activeTrack = propTrack !== undefined ? propTrack : globalTrack;
  const isVisible = propIsOpen !== undefined ? propIsOpen : Boolean(globalTrack);
  const handleClose = propOnClose || closeGlobal;

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, handleClose]);

  if (!isVisible || !activeTrack) return null;

  const handleSelectPlaylist = (playlist) => {
    const res = addTrackToPlaylist(playlist.id, activeTrack);
    if (res.added) {
      showToast(`Added "${activeTrack.title}" to ${res.playlistName}`);
    } else if (res.reason === 'duplicate') {
      showToast(`"${activeTrack.title}" is already in ${res.playlistName}`);
    } else {
      showToast('Could not add track to playlist');
    }
    handleClose();
  };

  const handleCreateAndAdd = async (e) => {
    e.preventDefault();
    const cleanName = newPlaylistName.trim();
    if (!cleanName) return;

    setIsCreating(true);
    try {
      const created = await createPlaylistWithTrack(cleanName, activeTrack);
      if (created) {
        showToast(`Created "${cleanName}" & added "${activeTrack.title}"`);
        setNewPlaylistName('');
        handleClose();
      }
    } catch {
      showToast('Failed to create playlist');
    } finally {
      setIsCreating(false);
    }
  };

  const coverUrl =
    activeTrack.cover ||
    activeTrack.thumbnailUrl ||
    activeTrack.thumbnail_url ||
    activeTrack.albumArt ||
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop';

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-playlist-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sc-card w-full max-w-sm rounded-2xl p-5 border border-white/15 bg-[#111113] shadow-[0_24px_50px_rgba(0,0,0,0.85)] flex flex-col max-h-[85vh] select-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-[#1ED760]" aria-hidden="true" />
            <h2 id="add-to-playlist-title" className="text-xs font-semibold uppercase tracking-wider text-[#F4F4F2]">
              Add to Playlist
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close add to playlist dialog"
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-[#8A8A8E] hover:text-[#F4F4F2] transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Selected Track Pill Banner */}
        <div className="flex items-center gap-3 p-2 my-3 rounded-xl bg-white/[0.04] border border-white/10 shrink-0">
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black/40">
            <CoverImage src={coverUrl} alt="" iconSize="w-4 h-4" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#F4F4F2] truncate">{activeTrack.title}</p>
            <p className="text-[11px] text-[#8A8A8E] truncate">{activeTrack.artist}</p>
          </div>
        </div>

        {/* Quick Inline "Create new playlist" Form */}
        <form onSubmit={handleCreateAndAdd} className="flex gap-2 mb-3 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="New playlist name..."
            aria-label="New playlist name"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-[#F4F4F2] placeholder-[#8A8A8E] outline-none focus:border-[#1ED760]/60 transition"
          />
          <button
            type="submit"
            disabled={!newPlaylistName.trim() || isCreating}
            aria-label="Create playlist and add song"
            className="sc-pill px-3 py-1.5 bg-[#1ED760] hover:bg-[#22e868] disabled:opacity-40 disabled:hover:bg-[#1ED760] text-black font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Create</span>
          </button>
        </form>

        {/* Existing User Playlists List */}
        <div className="overflow-y-auto no-scrollbar space-y-1.5 flex-1 min-h-[140px] pr-0.5">
          <span className="meta-label text-[9px] text-[#8A8A8E] block mb-1">CHOOSE PLAYLIST</span>

          {playlists.length > 0 ? (
            playlists.map((playlist) => {
              const tracksList = Array.isArray(playlist.tracks) ? playlist.tracks : [];
              const contains = tracksList.some(
                (t) => (t.videoId && t.videoId === activeTrack.videoId) || t.id === activeTrack.id
              );
              return (
                <button
                  key={playlist.id}
                  onClick={() => handleSelectPlaylist(playlist)}
                  aria-label={`Add track to ${playlist.name || playlist.title}`}
                  className="w-full p-2 rounded-xl flex items-center justify-between text-left hover:bg-white/[0.08] border border-white/[0.04] transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0 text-[#1ED760]">
                      <Music className="w-3.5 h-3.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                        {playlist.name || playlist.title}
                      </p>
                      <p className="text-[10px] text-[#8A8A8E] truncate">
                        {tracksList.length} {tracksList.length === 1 ? 'track' : 'tracks'}
                      </p>
                    </div>
                  </div>

                  {contains ? (
                    <span className="flex items-center gap-1 text-[10px] text-[#1ED760] font-mono shrink-0 pl-2">
                      <Check className="w-3 h-3" />
                      <span>Added</span>
                    </span>
                  ) : (
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[#8A8A8E] group-hover:text-[#1ED760] group-hover:bg-[#1ED760]/10 shrink-0 transition">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="py-6 px-3 text-center border border-dashed border-white/10 rounded-xl">
              <p className="text-xs text-[#8A8A8E]">No custom playlists yet</p>
              <p className="text-[10px] text-[#8A8A8E] mt-0.5">Type a name above to create your first playlist.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

