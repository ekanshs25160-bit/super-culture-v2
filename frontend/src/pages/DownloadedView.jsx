import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Play, FileDown } from 'lucide-react';
import { PageHeader, EmptyState, TrackRow } from '../components/shared';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAudio } from '../hooks/useAudio';
import { getOfflineAudioBlob } from '../utils/indexedDbAudio';
import { apiClient, API_BASE } from '../services/api';

export default function DownloadedView() {
  const navigate = useNavigate();
  const { playTrack, showToast } = useAudio();
  const downloadedTracks = useLibraryStore((s) => s.downloadedTracks);

  const handlePlayAll = () => {
    if (downloadedTracks.length === 0) return;
    playTrack(downloadedTracks[0], downloadedTracks);
    showToast(`Playing ${downloadedTracks.length} offline tracks`);
  };

  const handleSaveFile = async (e, track) => {
    e.stopPropagation();
    const videoId = track.videoId || track.id;
    if (!videoId) return;

    try {
      showToast(`Exporting "${track.title}"...`);
      let blob = await getOfflineAudioBlob(videoId);
      if (!blob && typeof caches !== 'undefined') {
        try {
          const cache = await caches.open('sc-offline-audio');
          const match = await cache.match(`/offline-audio/${videoId}`);
          if (match) blob = await match.blob();
        } catch {
          // ignore cache lookup error
        }
      }

      if (!blob) {
        const { url } = await apiClient.music.getStreamUrl(videoId, 'aac');
        const fullAudioUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
        const res = await fetch(fullAudioUrl);
        if (res.ok) blob = await res.blob();
      }

      if (!blob) {
        showToast('Could not retrieve audio file');
        return;
      }

      const fileUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileUrl;
      const cleanArtist = (track.artist || 'Unknown Artist').replace(/[\\/:*?"<>|]/g, '_');
      const cleanTitle = (track.title || 'Unknown Title').replace(/[\\/:*?"<>|]/g, '_');
      link.download = `${cleanArtist} - ${cleanTitle}.m4a`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(fileUrl);
      showToast(`Saved "${cleanTitle}.m4a" to device`);
    } catch (err) {
      console.error('[DownloadedView] Save file error:', err);
      showToast('Failed to save audio file');
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto no-scrollbar px-2 py-1 pb-24">
      <PageHeader
        title="Downloaded"
        meta="OFFLINE CACHE"
        subtitle={
          downloadedTracks.length > 0
            ? `${downloadedTracks.length} track${downloadedTracks.length === 1 ? '' : 's'} stored on this device for offline playback.`
            : 'Locally cached music streams and offline audio playback storage.'
        }
      >
        {downloadedTracks.length > 0 && (
          <button
            onClick={handlePlayAll}
            aria-label="Play all offline tracks"
            className="sc-pill px-4 py-1.5 bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
          >
            <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span>Play All Offline</span>
          </button>
        )}
      </PageHeader>

      {downloadedTracks.length === 0 ? (
        <EmptyState
          icon={Download}
          title="No Offline Tracks Downloaded"
          description="Save tracks for offline listening by clicking the download icon on any song row. Cached audio streams are stored directly on this device and play seamlessly without internet."
          actionLabel="Explore Library"
          onAction={() => navigate('/library')}
        />
      ) : (
        <div className="flex flex-col gap-1.5 mt-2">
          {downloadedTracks.map((track, idx) => (
            <div
              key={track.videoId || track.id || idx}
              className="relative flex items-center gap-2"
            >
              <div className="flex-1 min-w-0">
                <TrackRow
                  track={track}
                  index={idx}
                  queue={downloadedTracks}
                  showIndex={true}
                  showLike={true}
                  showAdd={true}
                  showDownload={true}
                />
              </div>
              <button
                onClick={(e) => handleSaveFile(e, track)}
                aria-label={`Save ${track.title} as audio file`}
                title="Save audio file (.m4a) to disk"
                className="sc-pill min-h-[38px] px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[#8A8A8E] hover:text-[#1ED760] text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 border border-white/10"
              >
                <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Save .m4a</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
