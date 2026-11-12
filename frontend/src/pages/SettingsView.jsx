import React, { useState, useContext } from 'react';
import { Volume2, Shield, Smile, Trash2, Check, Copy, Radio, Download, Smartphone, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/shared';
import { AudioContext } from '../context/AudioContext';
import { useLibraryStore } from '../store/useLibraryStore';
import { useUiStore } from '../store/useUiStore';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { getGuestId } from '../services/api';
import { APP_VERSION, GITHUB_REPO, checkForUpdate, openExternal } from '../services/updateService';

const PLAYBACK_ENGINES = [
  { id: 'Auto', label: 'Auto', desc: 'Background audio on mobile, YouTube on desktop' },
  { id: 'Audio stream', label: 'Audio stream', desc: 'Native audio element with lock-screen controls' },
  { id: 'YouTube player', label: 'YouTube player', desc: 'Official YouTube IFrame player' },
];

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
  const {
    playbackEngine,
    setPlaybackEngine,
    activeEngine,
    lastFallbackReason,
  } = useUiStore();
  const { canInstall, isIosSafari, isStandalone, promptInstall } = usePwaInstall();

  const [selectedQuality, setSelectedQuality] = useState('24bit');
  const [crossfade, setCrossfade] = useState(2);
  const guestId = getGuestId();
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateError('');
    try {
      setUpdateInfo(await checkForUpdate({ force: true }));
    } catch (e) {
      setUpdateError(e?.message || 'Could not reach GitHub');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

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
        {/* 1. Playback Engine Architecture */}
        <section className="sc-card p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="w-4 h-4 text-[#1ED760]" aria-hidden="true" />
            <h2 className="text-xs font-semibold text-[#F4F4F2] uppercase tracking-wider">
              Playback Engine
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            {PLAYBACK_ENGINES.map((eng) => {
              const isSelected = playbackEngine === eng.id;
              return (
                <button
                  key={eng.id}
                  onClick={() => {
                    setPlaybackEngine(eng.id);
                    showToast(`Playback engine set to ${eng.label}`);
                  }}
                  aria-label={`Select ${eng.label}`}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#1ED760] bg-[#1ED760]/10 text-[#F4F4F2]'
                      : 'border-white/10 bg-white/5 text-[#8A8A8E] hover:text-[#F4F4F2] hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-[#F4F4F2]">{eng.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#1ED760]" aria-hidden="true" />}
                  </div>
                  <span className="text-[10px] text-[#8A8A8E]">{eng.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Active Engine Diagnostics & Status */}
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#8A8A8E]">Active engine:</span>
              <span className="font-mono text-[#1ED760] font-medium bg-[#1ED760]/10 px-2 py-0.5 rounded-md border border-[#1ED760]/20">
                {activeEngine === 'audio' ? 'Audio stream (HTMLAudioElement)' : 'YouTube player (IFrame)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#8A8A8E]">Last fallback reason:</span>
              <span className="font-mono text-[#F4F4F2] bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                {lastFallbackReason || 'None'}
              </span>
            </div>
          </div>
        </section>

        {/* 2. PWA Application Installation */}
        <section className="sc-card p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4 text-[#1ED760]" aria-hidden="true" />
            <h2 className="text-xs font-semibold text-[#F4F4F2] uppercase tracking-wider">
              App Installation & Offline
            </h2>
          </div>
          <p className="text-xs text-[#8A8A8E] mb-3">
            Install Super Culture as a standalone PWA on mobile or desktop for background playback, lock-screen controls, and offline capabilities.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
            <div className="min-w-0">
              {isStandalone ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#1ED760] animate-pulse" />
                  <span className="text-xs font-semibold text-[#F4F4F2]">Installed (Standalone Mode)</span>
                </div>
              ) : canInstall ? (
                <div>
                  <span className="text-xs font-semibold text-[#F4F4F2]">Install Available</span>
                  <p className="text-[11px] text-[#8A8A8E]">Ready to install directly to your device home screen or dock.</p>
                </div>
              ) : isIosSafari ? (
                <div>
                  <span className="text-xs font-semibold text-[#F4F4F2]">iOS Safari Installation</span>
                  <p className="text-[11px] text-[#8A8A8E]">Tap <span className="text-white font-medium">Share</span> then <span className="text-white font-medium">&apos;Add to Home Screen&apos;</span></p>
                </div>
              ) : (
                <div>
                  <span className="text-xs font-semibold text-[#F4F4F2]">Web Browser Mode</span>
                  <p className="text-[11px] text-[#8A8A8E]">Supported on Chrome, Edge, and iOS Safari for home screen install.</p>
                </div>
              )}
            </div>

            {canInstall && (
              <button
                onClick={promptInstall}
                aria-label="Install Super Culture application"
                className="px-4 py-2 rounded-full bg-[#1ED760] text-[#0B0B0C] text-xs font-bold hover:scale-105 active:scale-95 transition cursor-pointer flex items-center gap-2 shrink-0 shadow-lg shadow-[#1ED760]/20"
              >
                <Download className="w-4 h-4" />
                <span>Install App</span>
              </button>
            )}
          </div>
        </section>

        {/* 2. Audio Engine & Quality */}
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

        {/* 5. App Updates (GitHub Releases) */}
        <section className="sc-card p-4 rounded-2xl">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-semibold text-[#F4F4F2] uppercase tracking-wider">App Updates</h2>
              <p className="text-xs text-[#8A8A8E] mt-0.5 truncate">
                Version {APP_VERSION} · {GITHUB_REPO}
              </p>
            </div>
            <button
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
              aria-label="Check for app updates"
              className="sc-pill shrink-0 min-h-[36px] px-3 py-1 bg-white/10 hover:bg-white/20 text-xs text-[#F4F4F2] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{isCheckingUpdate ? 'Checking…' : 'Check for Updates'}</span>
            </button>
          </div>

          {updateError && <p className="text-xs text-red-400">Update check failed: {updateError}</p>}
          {updateInfo && !updateInfo.hasUpdate && (
            <p className="text-xs text-[#1ED760]">You're up to date (v{updateInfo.currentVersion}).</p>
          )}
          {updateInfo?.hasUpdate && (
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">
              <p className="text-sm text-[#F4F4F2] font-semibold">Version {updateInfo.latestVersion} is available</p>
              {updateInfo.notes && <p className="text-xs text-[#8A8A8E] break-words">{updateInfo.notes}</p>}
              <button
                onClick={() => openExternal(updateInfo.apkUrl || updateInfo.releaseUrl)}
                aria-label="Download latest APK"
                className="sc-pill min-h-[36px] px-4 py-1.5 !bg-[#1ED760] !text-[#0B0B0C] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{updateInfo.apkUrl ? 'Download Latest APK' : 'Open Release Page'}</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
