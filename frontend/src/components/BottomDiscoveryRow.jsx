import React, { useState, useEffect, useMemo } from 'react';
import { Play, ChevronUp, ChevronDown, Flame, Compass, Sparkles } from 'lucide-react';
import { useAudio } from '../hooks/useAudio';
import { useLibraryStore } from '../store/useLibraryStore';
import { apiClient } from '../services/api';
import CoverImage from './shared/CoverImage';
import { deriveAudioAura } from '../utils/audioAura';

const HISTORY_KEY = 'super_culture_playback_history';

export default function BottomDiscoveryRow() {
  const { playSelectedTrack, showToast } = useAudio();
  const likedSongs = useLibraryStore((s) => s.likedSongs);
  const followedArtists = useLibraryStore((s) => s.followedArtists);

  // Starting position: both cards only display their titles (activeCard is null).
  // At a time only one card can be opened.
  const [activeCard, setActiveCard] = useState(null);
  const [historyTracks, setHistoryTracks] = useState(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [shelfTracks, setShelfTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const stored = localStorage.getItem(HISTORY_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        setHistoryTracks(Array.isArray(parsed) ? parsed : []);
      } catch {
        setHistoryTracks([]);
      }
    };
    window.addEventListener('super_culture_history_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('super_culture_history_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Load real tracks from home shelves as live fallback if history is sparse
  useEffect(() => {
    let isMounted = true;
    const fetchShelves = async () => {
      try {
        const data = await apiClient.music.getHomeShelves();
        if (isMounted && data?.shelves?.length) {
          const gathered = data.shelves.flatMap((s) => (Array.isArray(s.items) ? s.items : []));
          setShelfTracks(gathered);
        }
      } catch (err) {
        console.warn('[BottomDiscoveryRow] Shelves fetch error:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchShelves();
    return () => { isMounted = false; };
  }, []);

  // Merge real tracks (history -> likedSongs -> live home shelves) without duplicates
  const rotationTracks = useMemo(() => {
    const seen = new Set();
    const merged = [];

    const addTrack = (t) => {
      if (!t?.title) return;
      const id = t.videoId || t.id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      merged.push({
        id, videoId: id, title: t.title, artist: t.artist || 'Unknown Artist',
        cover: t.cover || t.thumbnailUrl || t.albumArt || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
        duration: t.durationFormatted || t.duration || '3:30', seconds: typeof t.duration === 'number' ? t.duration : 210,
      });
    };

    // 1. Tracks played by user in session
    for (const t of historyTracks) addTrack(t);
    // 2. Tracks liked by user
    for (const t of likedSongs) addTrack(t);
    // 3. Live real home shelves tracks
    for (const t of shelfTracks) addTrack(t);

    return merged.slice(0, 8);
  }, [historyTracks, likedSongs, shelfTracks]);

  // Derive real Audio Aura from actual user listening history and followed artists
  const audioAura = useMemo(() => {
    const derived = deriveAudioAura(historyTracks, likedSongs, followedArtists);
    if (derived.length > 0) return derived;
    return [
      { rank: 1, name: 'Ambient & Drone', percent: '45%' },
      { rank: 2, name: 'Electronic / Club', percent: '35%' },
      { rank: 3, name: 'Indie & R&B', percent: '20%' },
    ];
  }, [historyTracks, likedSongs, followedArtists]);

  const handleToggleCard = (cardKey) => {
    setActiveCard((prev) => (prev === cardKey ? null : cardKey));
  };

  const handleTrackClick = (track) => {
    playSelectedTrack(track, rotationTracks);
    showToast(`Playing from Heavy Rotation: ${track.title}`);
  };

  const handlePlayWeeklyArchive = (e) => {
    e.stopPropagation();
    if (rotationTracks.length > 0) {
      playSelectedTrack(rotationTracks[0], rotationTracks);
      showToast('Streaming Weekly Archive • Vol 04');
    } else {
      showToast('Weekly Archive is compiling...');
    }
  };

  const isRotationOpen = activeCard === 'rotation';
  const isMemoryOpen = activeCard === 'memory';

  return (
    <div className="flex flex-col xl:flex-row items-stretch xl:items-end gap-3 w-full transition-all duration-300">
      {/* Module A: Heavy Rotation (70% width / flex-1) */}
      <section
        className={`sc-card flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
          isRotationOpen
            ? 'ring-1 ring-[#1ED760]/40 shadow-[0_0_24px_rgba(30,215,96,0.12)]'
            : 'hover:border-white/20'
        }`}
      >
        {/* Title Header Bar (Always visible in starting position) */}
        <button
          onClick={() => handleToggleCard('rotation')}
          aria-expanded={isRotationOpen}
          aria-controls="heavy-rotation-panel"
          className="w-full flex items-center justify-between p-3.5 sm:px-4 cursor-pointer text-left select-none group transition bg-white/[0.02] hover:bg-white/[0.05]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Flame className="w-3.5 h-3.5 text-[#1ED760] shrink-0" aria-hidden="true" />
            <span className="meta-label text-[10px] text-[#F4F4F2] font-semibold tracking-wider truncate group-hover:text-[#1ED760] transition">
              HEAVY ROTATION • LAST 7 DAYS
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-[#8A8A8E] hidden sm:inline-block">
              {isRotationOpen ? 'COLLAPSE' : `${rotationTracks.length} TRACKS • REVEAL`}
            </span>
            {isRotationOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#1ED760] transition" aria-hidden="true" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-[#8A8A8E] group-hover:text-white transition" aria-hidden="true" />
            )}
          </div>
        </button>

        {/* Revealed Content in Card Form */}
        {isRotationOpen && (
          <div id="heavy-rotation-panel" className="p-4 pt-2 border-t border-white/5 animate-fadeIn">
            {loading && rotationTracks.length === 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-white/5 rounded-xl sc-shimmer" />
                ))}
              </div>
            ) : rotationTracks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {rotationTracks.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => handleTrackClick(track)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTrackClick(track);
                      }
                    }}
                    aria-label={`Play ${track.title} by ${track.artist}`}
                    className="bg-white/5 hover:bg-white/10 rounded-xl flex items-center gap-3 p-1.5 cursor-pointer transition border border-white/5 select-none group"
                  >
                    <CoverImage
                      src={track.cover}
                      alt=""
                      iconSize="w-3.5 h-3.5"
                      className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10 group-hover:scale-105 transition duration-200"
                    />
                    <div className="min-w-0 flex-1 pr-1">
                      <p className="text-xs font-medium text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                        {track.title}
                      </p>
                      <p className="text-[10px] text-[#8A8A8E] truncate">
                        {track.artist}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[#8A8A8E]">
                <Sparkles className="w-5 h-5 text-[#1ED760] mx-auto mb-1.5 opacity-70" />
                <p className="text-[#F4F4F2] font-medium">Rotation Initializing</p>
                <p className="text-[11px] mt-0.5">Play songs in the archive to build your personal heavy rotation.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Module B: Memory Map Snapshot (30% width / xl:w-[340px] shrink-0) */}
      <section
        className={`sc-card relative overflow-hidden w-full xl:w-[340px] shrink-0 flex flex-col justify-between transition-all duration-300 ${
          isMemoryOpen
            ? 'ring-1 ring-purple-500/40 shadow-[0_0_24px_rgba(168,85,247,0.15)]'
            : 'hover:border-white/20'
        }`}
      >
        {/* Absolute Audio Aura Radial Glow */}
        <div
          className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/40 via-[#0B0B0C]/0 to-transparent pointer-events-none transition-opacity duration-300 ${
            isMemoryOpen ? 'opacity-100' : 'opacity-30'
          }`}
          aria-hidden="true"
        />

        {/* Title Header Bar (Always visible in starting position) */}
        <button
          onClick={() => handleToggleCard('memory')}
          aria-expanded={isMemoryOpen}
          aria-controls="memory-map-panel"
          className="w-full flex items-center justify-between p-3.5 sm:px-4 cursor-pointer text-left select-none group relative z-10 transition bg-white/[0.02] hover:bg-white/[0.05]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Compass className="w-3.5 h-3.5 text-purple-400 shrink-0" aria-hidden="true" />
            <span className="meta-label font-mono text-[10px] text-[#F4F4F2] font-semibold tracking-wider truncate group-hover:text-purple-300 transition">
              MEMORY MAP • VOL 04
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-[#8A8A8E] hidden sm:inline-block">
              {isMemoryOpen ? 'COLLAPSE' : 'AUDIO AURA • REVEAL'}
            </span>
            {isMemoryOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-purple-300 transition" aria-hidden="true" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-[#8A8A8E] group-hover:text-white transition" aria-hidden="true" />
            )}
          </div>
        </button>

        {/* Revealed Content in Card Form */}
        {isMemoryOpen && (
          <div id="memory-map-panel" className="p-4 pt-2 border-t border-white/5 relative z-10 space-y-3 animate-fadeIn">
            <div>
              <h3 className="font-serif italic text-2xl font-bold text-[#F4F4F2] mb-2.5">
                Your Audio Aura
              </h3>

              <div className="space-y-1.5">
                {audioAura.map((genre) => (
                  <div
                    key={genre.rank}
                    className="flex items-center justify-between text-xs text-[#F4F4F2]/90 font-medium"
                  >
                    <span>{genre.rank}. {genre.name}</span>
                    <span className="text-[10px] font-mono text-[#8A8A8E]">
                      {genre.percent}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Play Weekly Archive Button */}
            <button
              onClick={handlePlayWeeklyArchive}
              aria-label="Play Weekly Archive"
              className="sc-pill w-full py-2 px-3 text-xs font-semibold text-[#F4F4F2] bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-center gap-2 cursor-pointer transition relative z-10 shadow-lg group"
            >
              <Play className="w-3.5 h-3.5 fill-current text-[#1ED760] ml-0.5 group-hover:scale-110 transition" aria-hidden="true" />
              <span>Play Weekly Archive</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
