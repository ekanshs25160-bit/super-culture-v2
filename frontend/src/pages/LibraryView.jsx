import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, X, Loader2 } from 'lucide-react';
import { PageHeader, PlaylistCard, Skeleton, ConfirmDialog } from '../components/shared';
import { useAudio } from '../hooks/useAudio';
import { useLibraryStore } from '../store/useLibraryStore';
import { apiClient } from '../services/api';

export default function LibraryView() {
  const navigate = useNavigate();
  const { playTrack, showToast } = useAudio();
  const {
    likedCount,
    playlists: storePlaylists,
    likedSongs,
    loading,
    createPlaylist,
    createPlaylistWithMultipleTracks,
    deletePlaylist,
  } = useLibraryStore();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPlaylistName, setImportPlaylistName] = useState('');
  const [importTracklistText, setImportTracklistText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);

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

  const handleOpenImport = () => {
    setImportPlaylistName(`Imported Playlist #${storePlaylists.length + 1}`);
    setImportTracklistText('');
    setIsImportModalOpen(true);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    const lines = importTracklistText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      showToast('Please paste at least one song line to import.');
      return;
    }

    setIsImporting(true);
    try {
      const payload = { tracklist: lines.slice(0, 20) };
      const res = await apiClient.music.importTracklist(payload.tracklist);

      const matchedTracks = res.tracks || [];
      if (matchedTracks.length === 0) {
        showToast('No matching tracks could be found for your list.');
        setIsImporting(false);
        return;
      }

      const nameToUse = importPlaylistName.trim() || `Imported Playlist (${matchedTracks.length} tracks)`;
      const created = await createPlaylistWithMultipleTracks(nameToUse, matchedTracks);

      showToast(`Imported ${matchedTracks.length} tracks into "${nameToUse}"`);
      setIsImportModalOpen(false);
      setImportTracklistText('');

      if (created?.id) {
        navigate(`/library/${created.id}`);
      }
    } catch (err) {
      console.error('[LibraryView] Import tracklist error:', err);
      showToast(err.response?.data?.error || 'Failed to import playlist');
    } finally {
      setIsImporting(false);
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenImport}
            aria-label="Import playlist from text"
            className="sc-pill px-3.5 py-1.5 bg-white/10 hover:bg-white/15 text-[#F4F4F2] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer border border-white/10"
          >
            <FileText className="w-3.5 h-3.5 text-[#1ED760]" aria-hidden="true" />
            <span>Import Playlist</span>
          </button>
          <button
            onClick={handleCreateNew}
            aria-label="Create new playlist"
            className="sc-pill px-3.5 py-1.5 bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New Playlist</span>
          </button>
        </div>
      </PageHeader>

      {/* Glassmorphic Playlist Text Importer Modal */}
      {isImportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-lg bg-[#141416]/95 border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-[#F4F4F2]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="meta-label text-[10px] text-[#1ED760]">PLAYLIST IMPORTER</span>
                <h2 id="import-modal-title" className="text-lg font-bold text-white mt-0.5">
                  Import Tracklist
                </h2>
              </div>
              <button
                onClick={() => !isImporting && setIsImportModalOpen(false)}
                disabled={isImporting}
                aria-label="Close modal"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition cursor-pointer text-[#8A8A8E] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#8A8A8E] leading-relaxed">
              Paste song titles or &ldquo;Artist - Track&rdquo; (one song per line, up to 20 tracks). Each song is automatically searched, verified, and compiled into a new playlist.
            </p>

            <form onSubmit={handleImportSubmit} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[#8A8A8E] mb-1.5">
                  Playlist Name
                </label>
                <input
                  type="text"
                  value={importPlaylistName}
                  onChange={(e) => setImportPlaylistName(e.target.value)}
                  placeholder="e.g. Late Night Drives"
                  disabled={isImporting}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#1ED760] transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-[#8A8A8E]">
                    Songs List (one per line)
                  </label>
                  <span className="text-[10px] font-mono text-[#8A8A8E]">
                    {importTracklistText.split('\n').filter((l) => l.trim()).length}/20 max
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={importTracklistText}
                  onChange={(e) => setImportTracklistText(e.target.value)}
                  disabled={isImporting}
                  placeholder={`Kendrick Lamar - DNA\nDrake - One Dance\nFrank Ocean - Nights\nAphex Twin - Xtal`}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-[#1ED760] transition resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  disabled={isImporting}
                  className="px-4 py-2 rounded-full text-xs font-medium text-[#8A8A8E] hover:text-white hover:bg-white/5 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !importTracklistText.trim()}
                  className="px-4 py-2 rounded-full bg-[#1ED760] hover:bg-[#22e868] disabled:opacity-50 text-[#0B0B0C] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Matching Tracks...</span>
                    </>
                  ) : (
                    <span>Import &amp; Create</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              onDelete={pl.id !== 'liked-songs' ? () => setPlaylistToDelete(pl) : undefined}
            />
          ))}
        </div>
      )}

      {/* Delete Playlist Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(playlistToDelete)}
        title="Delete Playlist"
        message={`Are you sure you want to delete "${playlistToDelete?.title || 'this playlist'}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!playlistToDelete) return;
          const target = playlistToDelete;
          setPlaylistToDelete(null);
          const ok = await deletePlaylist(target.id);
          if (ok) {
            showToast(`Deleted "${target.title}"`);
          } else {
            showToast('Failed to delete playlist');
          }
        }}
        onCancel={() => setPlaylistToDelete(null)}
      />
    </div>
  );
}
