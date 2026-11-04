import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Play } from 'lucide-react';
import { PageHeader, EmptyState, TrackRow } from '../components/shared';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAudio } from '../hooks/useAudio';

export default function DownloadedView() {
  const navigate = useNavigate();
  const { playTrack, showToast } = useAudio();
  const downloadedTracks = useLibraryStore((s) => s.downloadedTracks);

  const handlePlayAll = () => {
    if (downloadedTracks.length === 0) return;
    playTrack(downloadedTracks[0], downloadedTracks);
    showToast(`Playing ${downloadedTracks.length} offline tracks`);
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
            <TrackRow
              key={track.videoId || track.id || idx}
              track={track}
              index={idx}
              queue={downloadedTracks}
              showIndex={true}
              showLike={true}
              showAdd={true}
              showDownload={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
