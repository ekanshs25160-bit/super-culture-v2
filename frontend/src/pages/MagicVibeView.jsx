import React, { useState } from 'react';
import { Sparkles, Play, BookmarkPlus, Disc } from 'lucide-react';
import { PageHeader, TrackRow, Skeleton } from '../components/shared';
import { useAudio } from '../hooks/useAudio';
import { useLibraryStore } from '../store/useLibraryStore';
import { apiClient } from '../services/api';
import { INITIAL_TRACK_QUEUE, TRENDING_TRACKS } from '../data/tracks';

const MOOD_CHIPS = [
  { id: 'energetic', label: 'Energetic', emoji: '⚡', prompt: 'High-octane club beats, driving synth baselines, and energetic rhythm' },
  { id: 'chill', label: 'Chill', emoji: '☕', prompt: 'Warm analog chords, smooth downtempo beats, and relaxed evening lofi' },
  { id: 'melancholic', label: 'Melancholic', emoji: '🌧️', prompt: 'Cinematic minor-key piano, slow-burn trip hop, and emotional strings' },
  { id: 'focused', label: 'Focused', emoji: '🎯', prompt: 'Repetitive minimalist techno, deep ambient drone, and tape saturation' },
  { id: 'tokyo-drift', label: 'Tokyo Drive', emoji: '🏎️', prompt: 'Melancholic synthwave and vapor ambient for 2AM highway runs' },
  { id: 'cinema', label: 'OLED Cinema', emoji: '🎬', prompt: 'Cinematic orchestral textures and slow-burn avant-garde soundscapes' },
];

export default function MagicVibeView() {
  const [prompt, setPrompt] = useState('');
  const [activeChip, setActiveChip] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeVibeTracks, setActiveVibeTracks] = useState(INITIAL_TRACK_QUEUE);
  const [generationMeta, setGenerationMeta] = useState('Initial Curated Selection');

  const { playTrack, showToast } = useAudio();
  const { createPlaylist } = useLibraryStore();

  const handleGenerate = async (customPrompt, chipLabel) => {
    const text = customPrompt || prompt;
    if (!text.trim()) return;
    setIsGenerating(true);
    setGenerationMeta(chipLabel || text.slice(0, 32));

    try {
      const results = await apiClient.ai.generateVibe({
        mood: chipLabel || 'Avant-Garde Curated',
        genre: 'Editorial Mix',
        referenceSongs: text.trim(),
      });

      if (Array.isArray(results) && results.length > 0) {
        const mapped = results.map((r, i) => ({
          id: `vibe-${i}-${Date.now()}`,
          videoId: 'MV_3Dpw-BRY',
          title: r.title,
          artist: r.artist,
          reason: r.reason,
          cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
          duration: '3:45',
          seconds: 225,
        }));
        setActiveVibeTracks(mapped);
        showToast(`Synthesized ${mapped.length} vibe tracks with Gemini 2.0`);
      } else {
        const shuffled = [...INITIAL_TRACK_QUEUE, ...TRENDING_TRACKS].sort(() => 0.5 - Math.random());
        setActiveVibeTracks(shuffled.slice(0, 8));
      }
    } catch (err) {
      console.warn('[MagicVibe] AI generator error, using offline seed:', err);
      const shuffled = [...INITIAL_TRACK_QUEUE, ...TRENDING_TRACKS].sort(() => 0.5 - Math.random());
      setActiveVibeTracks(shuffled.slice(0, 8));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePlaylist = async () => {
    const name = `Vibe: ${generationMeta}`;
    const desc = `Synthesized via Gemini 2.0 AI based on: "${prompt || generationMeta}"`;
    const created = await createPlaylist(name, desc);
    if (created) {
      showToast(`Saved playlist "${name}" to your Library`);
    }
  };

  const handlePlayAll = () => {
    if (activeVibeTracks.length > 0) {
      playTrack(activeVibeTracks[0], activeVibeTracks);
      showToast(`Playing AI Vibe: ${generationMeta}`);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto no-scrollbar px-2 py-1 pb-24">
      <PageHeader
        title="Magic Vibe"
        meta="GEMINI 2.0 AI SYNTHESIZER"
        subtitle="Prompt the avant-garde editorial tastemaker to synthesize a sonic atmosphere."
      />

      {/* AI Prompt Input Card */}
      <div className="sc-card p-4 mb-4 rounded-2xl shrink-0">
        <label className="meta-label text-[10px] text-[#8A8A8E] block mb-2">
          DESCRIBE YOUR DESIRED SONIC ATMOSPHERE
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setActiveChip(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGenerate();
            }}
            placeholder="e.g. Rainy rooftop in Shibuya listening to muffled ambient breakbeats..."
            aria-label="Describe desired sonic atmosphere"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-[#F4F4F2] placeholder-[#8A8A8E] outline-none focus:border-[#1ED760]/50"
          />
          <button
            onClick={() => handleGenerate()}
            disabled={isGenerating}
            aria-label="Synthesize music vibe"
            className="sc-pill px-4 bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            )}
            <span>Synthesize</span>
          </button>
        </div>

        {/* Mood Chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {MOOD_CHIPS.map((chip) => {
            const isSelected = activeChip === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => {
                  setActiveChip(chip.id);
                  setPrompt(chip.prompt);
                  handleGenerate(chip.prompt, chip.label);
                }}
                aria-label={`Select mood ${chip.label}`}
                className={`sc-pill px-3 py-1.5 text-xs flex items-center gap-1.5 transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#1ED760] text-[#0B0B0C] font-semibold shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 text-[#8A8A8E] hover:text-[#F4F4F2]'
                }`}
              >
                <span>{chip.emoji}</span>
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Generated Playlist Card / Toolbar */}
      <div className="sc-card p-4 mb-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1ED760] to-[#0A8742] flex items-center justify-center text-black shadow-md shrink-0">
            <Disc className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#F4F4F2]">
              {generationMeta}
            </h2>
            <p className="text-xs text-[#8A8A8E]">
              {activeVibeTracks.length} Curated Tracks • Gemini 2.0 Flash
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayAll}
            aria-label="Play all synthesized tracks"
            className="sc-pill px-3.5 py-1.5 bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
            <span>Play All</span>
          </button>

          <button
            onClick={handleSavePlaylist}
            aria-label="Save as new playlist"
            className="sc-pill px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-[#F4F4F2] text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Save as Playlist</span>
          </button>
        </div>
      </div>

      {/* Track List */}
      <div className="space-y-2">
        {isGenerating ? (
          <Skeleton.Row count={6} />
        ) : (
          activeVibeTracks.map((t, idx) => (
            <TrackRow key={t.id + idx} track={t} index={idx} queue={activeVibeTracks} />
          ))
        )}
      </div>
    </div>
  );
}
