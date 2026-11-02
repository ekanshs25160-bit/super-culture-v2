import React, { useState } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { PageHeader, TrackRow, EmptyState } from '../components/shared';
import { useAudio } from '../hooks/useAudio';

const HISTORY_KEY = 'super_culture_playback_history';

export default function RecentsView() {
  const { currentTrack, showToast } = useAudio();
  const [history, setHistory] = useState(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to parse history:', e);
      return [];
    }
  });

  // Combine currentTrack at the top if active
  const displayedHistory = React.useMemo(() => {
    if (!currentTrack || !currentTrack.title) return history;
    const exists = history.some((t) => (t.videoId || t.id) === (currentTrack.videoId || currentTrack.id));
    if (exists) return history;
    return [currentTrack, ...history];
  }, [currentTrack, history]);

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      console.warn('Failed to clear history:', e);
    }
    showToast('Listening history cleared');
  };

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto no-scrollbar px-2 py-1 pb-24">
      <PageHeader
        title="Recents"
        meta={`${displayedHistory.length} SESSIONS`}
        subtitle="Recent playback memory synced across your active guest session."
      >
        {displayedHistory.length > 0 && (
          <button
            onClick={handleClearHistory}
            aria-label="Clear listening history"
            className="sc-pill px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[#8A8A8E] hover:text-[#F4F4F2] text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear</span>
          </button>
        )}
      </PageHeader>

      <div className="space-y-2">
        {displayedHistory.length > 0 ? (
          displayedHistory.map((t, idx) => (
            <TrackRow key={(t.videoId || t.id) + idx} track={t} index={idx} queue={displayedHistory} />
          ))
        ) : (
          <EmptyState
            icon={Clock}
            title="No Listening History"
            description="Tracks you play will appear here automatically as your sonic taste profile evolves."
          />
        )}
      </div>
    </div>
  );
}
