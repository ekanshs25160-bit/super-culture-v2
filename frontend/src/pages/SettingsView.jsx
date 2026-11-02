import React, { useState, useContext } from 'react';
import { Volume2, Shield, Smile, Trash2, Check, Copy } from 'lucide-react';
import { PageHeader } from '../components/shared';
import { AudioContext } from '../context/AudioContext';
import { useLibraryStore } from '../store/useLibraryStore';
import { getGuestId } from '../services/api';

const AUDIO_QUALITIES = [
  { id: '24bit', label: '24-Bit / 96kHz', desc: 'Hi-Res Lossless FLAC / bit-perfect' },
  { id: '16bit', label: '16-Bit / 44.1kHz', desc: 'CD Quality Lossless ALAC' },
  { id: '320k', label: '320 kbps AAC', desc: 'Optimized high-efficiency stream' },
];

const MOOD_OPTIONS = [
  { index: 0, name: 'Energetic', icon: '⚡' },
  { index: 1, name: 'Chill', icon: '☕' },
  { index: 2, name: 'Melancholic', icon: '🌧️' },
  { index: 3, name: 'Focused', icon: '🎯' },
];

export default function SettingsView() {
  const { privacyMode, setPrivacyMode, showToast } = useContext(AudioContext);
  const { mood, mode, setMood, setMode } = useLibraryStore();

  const [selectedQuality, setSelectedQuality] = useState('24bit');
  const [crossfade, setCrossfade] = useState(2);
  const guestId = getGuestId();

  const handleCopyGuestId = () => {
    navigator.clipboard?.writeText(guestId);
    showToast('Guest Session ID copied to clipboard');
  };

  const handleClearHistory = () => {
    try {
      localStorage.removeItem('super_culture_playback_history');
      localStorage.removeItem('super_culture_recent_searches');
    } catch (e) {
      console.warn('Failed to clear local caches:', e);
    }
    showToast('All playback & search history cleared');
  };

  const currentMode = mode || privacyMode;

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto no-scrollbar px-2 py-1 pb-24">
      <PageHeader
        title="Settings"
        meta="AUDIO & PROFILE"
        subtitle="Configure audio buffer quality, session privacy, and taste presets."
      />

      <div className="space-y-4">
        {/* 1. Audio Engine & Quality */}
        <section className="sc-card p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Volume2 className="w-4 h-4 text-[#1ED760]" aria-hidden="true" />
            <h2 className="text-xs font-semibold text-[#F4F4F2] uppercase tracking-wider">
              Audio Streaming Quality
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            {AUDIO_QUALITIES.map((q) => {
              const isSelected = selectedQuality === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setSelectedQuality(q.id);
                    showToast(`Audio set to ${q.label}`);
                  }}
                  aria-label={`Select ${q.label}`}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#1ED760] bg-[#1ED760]/10 text-[#F4F4F2]'
                      : 'border-white/10 bg-white/5 text-[#8A8A8E] hover:text-[#F4F4F2] hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-[#F4F4F2]">{q.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#1ED760]" aria-hidden="true" />}
                  </div>
                  <span className="text-[10px] text-[#8A8A8E]">{q.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Crossfade Transition Slider */}
          <div className="pt-3 border-t border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#F4F4F2]">Crossfade Duration</span>
              <span className="font-mono text-xs text-[#1ED760]">{crossfade}s</span>
            </div>
            <input
              type="range"
              min="0"
              max="12"
              value={crossfade}
              onChange={(e) => setCrossfade(Number(e.target.value))}
              aria-label="Crossfade duration in seconds"
              className="w-full accent-[#1ED760] cursor-pointer"
            />
          </div>
        </section>

        {/* 2. Public vs Private Session Mode */}
        <section className="sc-card p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-[#1ED760]" aria-hidden="true" />
            <h2 className="text-xs font-semibold text-[#F4F4F2] uppercase tracking-wider">
              Session Privacy
            </h2>
          </div>
          <p className="text-xs text-[#8A8A8E] mb-3">
            Choose whether your live audio telemetry and queue are broadcast to friends and live rooms.
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setMode('public');
                setPrivacyMode('public');
                showToast('Switched to Public Mode');
              }}
              aria-label="Set mode to Public"
              className={`sc-pill flex-1 py-2 text-xs font-medium transition cursor-pointer ${
                currentMode === 'public'
                  ? '!bg-[#F4F4F2] !text-[#0B0B0C] font-semibold'
                  : 'bg-white/5 hover:bg-white/10 text-[#8A8A8E] hover:text-[#F4F4F2]'
              }`}
            >
              Public Mode
            </button>
            <button
              onClick={() => {
                setMode('private');
                setPrivacyMode('private');
                showToast('Switched to Private Mode');
              }}
              aria-label="Set mode to Private"
              className={`sc-pill flex-1 py-2 text-xs font-medium transition cursor-pointer ${
                currentMode === 'private'
                  ? '!bg-[#F4F4F2] !text-[#0B0B0C] font-semibold'
                  : 'bg-white/5 hover:bg-white/10 text-[#8A8A8E] hover:text-[#F4F4F2]'
              }`}
            >
              Private Session (Incognito)
            </button>
          </div>
        </section>

        {/* 3. Default Mood Selector */}
        <section className="sc-card p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Smile className="w-4 h-4 text-[#1ED760]" aria-hidden="true" />
            <h2 className="text-xs font-semibold text-[#F4F4F2] uppercase tracking-wider">
              Default Mood Preset
            </h2>
          </div>
          <p className="text-xs text-[#8A8A8E] mb-3">
            Pre-conditions Gemini 2.0 AI smart shuffle and editorial homepage recommendations.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MOOD_OPTIONS.map((m) => {
              const isSelected = (mood?.name || '').toLowerCase() === m.name.toLowerCase();
              return (
                <button
                  key={m.name}
                  onClick={() => {
                    setMood(m.index, m.name);
                    showToast(`Default mood set to ${m.name}`);
                  }}
                  aria-label={`Set default mood to ${m.name}`}
                  className={`sc-pill py-2 text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                    isSelected
                      ? '!bg-[#F4F4F2] !text-[#0B0B0C] font-semibold'
                      : 'bg-white/5 hover:bg-white/10 text-[#8A8A8E] hover:text-[#F4F4F2]'
                  }`}
                >
                  <span>{m.icon}</span>
                  <span>{m.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. Vault Storage & Clear History */}
        <section className="sc-card p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-semibold text-[#F4F4F2] uppercase tracking-wider">
                Playback Cache & Session ID
              </h2>
              <p className="text-xs text-[#8A8A8E] mt-0.5">
                Manage your persisted guest token and offline playback cache.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
            <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
              <span className="meta-label text-[9px] text-[#1ED760]">GUEST ID</span>
              <span className="font-mono text-xs text-[#F4F4F2] truncate">{guestId}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyGuestId}
                aria-label="Copy guest session ID"
                className="sc-pill px-3 py-1 bg-white/10 hover:bg-white/20 text-xs text-[#F4F4F2] flex items-center gap-1.5 transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copy ID</span>
              </button>

              <button
                onClick={handleClearHistory}
                aria-label="Clear listening history and search cache"
                className="sc-pill px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear History</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
