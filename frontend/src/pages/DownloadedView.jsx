import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { PageHeader, EmptyState } from '../components/shared';

export default function DownloadedView() {
  const navigate = useNavigate();

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto no-scrollbar px-2 py-1 pb-24">
      <PageHeader
        title="Downloaded"
        meta="OFFLINE CACHE"
        subtitle="High-fidelity offline cached music tracks and lossless FLAC storage."
      />

      <EmptyState
        icon={Download}
        title="Offline Downloads Not Available Yet"
        description="Local encrypted track caching and offline playback synchronization require the offline storage bridge currently in development."
        missingEndpoint="GET /api/library/downloads"
        actionLabel="Explore Library"
        onAction={() => navigate('/library')}
      />
    </div>
  );
}
