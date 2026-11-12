import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Music, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseCsvPlaylist, normalizeTrackMetadata } from '../../utils/csvPlaylistParser';
import { apiClient } from '../../services/api';
import { useLibraryStore } from '../../store/useLibraryStore';

export default function CsvImportModal({ isOpen, onClose, onImportComplete, showToast }) {
  const [file, setFile] = useState(null);
  const [playlistName, setPlaylistName] = useState('');
  const [parsedTracks, setParsedTracks] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef(null);
  const isCancelledRef = useRef(false);

  const createPlaylistWithMultipleTracks = useLibraryStore((s) => s.createPlaylistWithMultipleTracks);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const baseName = selectedFile.name.replace(/\.[^/.]+$/, '').trim();
    setPlaylistName(baseName || 'Imported CSV Playlist');
    setFile(selectedFile);
    setParseErrors([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const { tracks, errors } = parseCsvPlaylist(text);
        setParsedTracks(tracks);
        setParseErrors(errors);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleCancelImport = () => {
    isCancelledRef.current = true;
    setIsImporting(false);
    if (showToast) showToast('CSV import cancelled');
  };

  const handleStartImport = async (e) => {
    e.preventDefault();
    if (parsedTracks.length === 0) {
      if (showToast) showToast('No valid tracks found to import');
      return;
    }

    const finalName = playlistName.trim() || file?.name?.replace(/\.[^/.]+$/, '') || 'Imported Playlist';
    setIsImporting(true);
    isCancelledRef.current = false;

    const totalCount = parsedTracks.length;
    setProgress({ current: 0, total: totalCount });

    const baseImportTimestamp = Date.now();
    const matchedTracks = [];
    let currentIndex = 0;
    let completedCount = 0;

    const CONCURRENCY = 3;

    async function worker() {
      while (currentIndex < totalCount) {
        if (isCancelledRef.current) break;
        const idx = currentIndex++;
        const row = parsedTracks[idx];

        try {
          const query = `${row.title} ${row.artist}`.trim();
          const res = await apiClient.music.search(query, 1);
          const rawTracks = Array.isArray(res?.tracks)
            ? res.tracks
            : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.data?.tracks)
            ? res.data.tracks
            : Array.isArray(res)
            ? res
            : [];

          if (rawTracks.length > 0 && (rawTracks[0].videoId || rawTracks[0].id)) {
            const match = rawTracks[0];
            matchedTracks.push(
              normalizeTrackMetadata(match, {
                title: row.title,
                artist: row.artist,
                album: row.album,
                durationMs: row.durationMs,
                artworkUrl: row.artworkUrl,
                addedAt: baseImportTimestamp + idx,
              })
            );
          }
        } catch (err) {
          console.warn(`[CsvImportModal] Match failed for "${row.title}":`, err?.message);
        } finally {
          completedCount++;
          setProgress({ current: completedCount, total: totalCount });
        }
      }
    }

    const workers = [];
    for (let w = 0; w < CONCURRENCY; w++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    setIsImporting(false);

    if (isCancelledRef.current) {
      if (matchedTracks.length === 0) return;
    }

    if (matchedTracks.length === 0) {
      if (showToast) showToast('No matching tracks could be resolved on YouTube');
      return;
    }

    // Preserve original CSV order based on addedAt (baseImportTimestamp + idx)
    matchedTracks.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

    try {
      const created = await createPlaylistWithMultipleTracks(finalName, matchedTracks);
      const msg = `Imported ${matchedTracks.length} of ${totalCount} tracks into "${finalName}"`;
      if (showToast) showToast(msg);
      if (onImportComplete) {
        onImportComplete(created);
      }
      onClose();
    } catch (saveErr) {
      console.error('[CsvImportModal] Failed creating playlist:', saveErr);
      if (showToast) showToast('Failed to save imported playlist');
    }
  };

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-import-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#141416]/95 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-[#F4F4F2]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <span className="meta-label text-[10px] text-[#1ED760] font-semibold tracking-wider">CSV PLAYLIST IMPORTER</span>
            <h2 id="csv-import-modal-title" className="text-lg font-bold text-white mt-0.5">
              Import from CSV File
            </h2>
          </div>
          <button
            onClick={() => !isImporting && onClose()}
            disabled={isImporting}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition cursor-pointer text-[#8A8A8E] hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#8A8A8E] leading-relaxed">
          Upload a playlist CSV exported from Spotify (Exportify), TuneMyMusic, Soundiiz, Apple Music, or generic spreadsheets. Each track is matched against YouTube Music and saved to your library.
        </p>

        <form onSubmit={handleStartImport} className="flex flex-col gap-4">
          {/* File Picker */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={isImporting}
              className="hidden"
              id="csv-file-input"
            />
            <label
              htmlFor="csv-file-input"
              className={`w-full flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed transition cursor-pointer ${
                file
                  ? 'border-[#1ED760]/40 bg-[#1ED760]/5'
                  : 'border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/25'
              } ${isImporting ? 'pointer-events-none opacity-60' : ''}`}
            >
              {file ? (
                <div className="flex items-center gap-3 text-left w-full">
                  <div className="w-10 h-10 rounded-xl bg-[#1ED760]/10 flex items-center justify-center text-[#1ED760] shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                    <p className="text-[11px] text-[#8A8A8E]">
                      {parsedTracks.length} tracks detected • {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <span className="text-xs text-[#1ED760] hover:underline shrink-0">Change</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/70 mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-white">Click or drag a .csv file here</span>
                  <span className="text-[10px] text-[#8A8A8E] mt-0.5">Spotify, TuneMyMusic, Soundiiz, generic CSV</span>
                </div>
              )}
            </label>
          </div>

          {/* Playlist Name Input */}
          {file && (
            <div>
              <label htmlFor="csv-playlist-name" className="block text-xs font-medium text-[#8A8A8E] mb-1.5">
                Playlist Name
              </label>
              <input
                id="csv-playlist-name"
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="e.g. My Favorite Songs"
                disabled={isImporting}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#1ED760] transition"
              />
            </div>
          )}

          {/* Parsed Preview */}
          {parsedTracks.length > 0 && !isImporting && (
            <div className="bg-black/30 border border-white/5 rounded-xl p-3 max-h-36 overflow-y-auto">
              <span className="text-[10px] uppercase font-mono text-[#8A8A8E] block mb-1.5">
                Track Preview ({parsedTracks.length} items)
              </span>
              <div className="flex flex-col gap-1.5">
                {parsedTracks.slice(0, 5).map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs truncate">
                    <Music className="w-3.5 h-3.5 text-[#1ED760] shrink-0" />
                    <span className="text-white font-medium truncate">{t.title}</span>
                    <span className="text-[#8A8A8E] truncate">— {t.artist}</span>
                  </div>
                ))}
                {parsedTracks.length > 5 && (
                  <span className="text-[11px] text-[#8A8A8E] italic pt-1">
                    ...and {parsedTracks.length - 5} more tracks
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error Notice */}
          {parseErrors.length > 0 && !isImporting && (
            <div className="flex items-start gap-2 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{parseErrors.length} rows had warnings or missing fields and were skipped.</span>
            </div>
          )}

          {/* Live Matching Progress Bar */}
          {isImporting && (
            <div className="flex flex-col gap-2 p-4 bg-white/5 border border-white/10 rounded-2xl">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-medium text-white">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1ED760]" />
                  Matching tracks: {progress.current} / {progress.total}...
                </span>
                <span className="font-mono text-[#1ED760]">{progressPct}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1ED760] transition-all duration-200 rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[11px] text-[#8A8A8E]">Resolving high-quality streams via YouTube Music...</p>
            </div>
          )}

          {/* Modal Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            {isImporting ? (
              <button
                type="button"
                onClick={handleCancelImport}
                className="shrink-0 min-h-[36px] sm:min-h-[40px] px-4 py-2 rounded-full text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition cursor-pointer"
              >
                Cancel Import
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 min-h-[36px] sm:min-h-[40px] px-4 py-2 rounded-full text-xs font-medium text-[#8A8A8E] hover:text-white hover:bg-white/5 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={parsedTracks.length === 0}
                  className="shrink-0 min-h-[36px] sm:min-h-[40px] px-5 py-2 rounded-full bg-[#1ED760] hover:bg-[#22e868] disabled:opacity-40 text-[#0B0B0C] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <span>Import &amp; Create Playlist</span>
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
