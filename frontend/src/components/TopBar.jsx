import { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Sparkles, Bell, Settings, Maximize2, Globe, Lock } from 'lucide-react';
import { AudioContext } from '../context/AudioContext';
import { useLibraryStore } from '../store/useLibraryStore';
import { apiClient } from '../services/api';
import { NotificationsPopover, QuickSettingsPopover } from './TopBarPopovers';
import Wordmark from './Wordmark';
import CoverImage from './shared/CoverImage';

export default function TopBar() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const {
    showToast,
    isAiDjActive,
    toggleAiDj,
    privacyMode,
    setPrivacyMode,
    playTrack,
  } = useContext(AudioContext);

  const { mode, setMode } = useLibraryStore();

  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const [typedVal, setTypedVal] = useState(null);
  const qParam = location.pathname === '/search'
    ? new URLSearchParams(location.search).get('q') || ''
    : '';
  const searchVal = typedVal !== null ? typedVal : qParam;
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [localTime, setLocalTime] = useState('');

  const notifRef = useRef(null);
  const settingsRef = useRef(null);

  // Update clock every second for telemetry chip
  useEffect(() => {
    const updateTime = () => setLocalTime(new Date().toTimeString().split(' ')[0]);
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // ⌘K shortcut listener & click-outside to close popovers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsNotifOpen(false);
        setIsSettingsOpen(false);
      }
    };

    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setIsSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setTypedVal(null);
    if (searchVal.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchVal.trim())}`);
    } else {
      navigate('/search');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      showToast('Entered Fullscreen Canvas');
    } else {
      document.exitFullscreen().catch(() => {});
      showToast('Exited Fullscreen Canvas');
    }
  };

  const handleAiDjClick = async () => {
    if (!isAiDjActive) {
      setIsAiLoading(true);
      toggleAiDj();
      showToast('AI DJ initializing smart queue...');
      try {
        const recs = await apiClient.ai.getAIDJ();
        if (Array.isArray(recs) && recs.length > 0) {
          const rec = recs[0];
          playTrack({
            id: `ai-dj-${Date.now()}`,
            videoId: 'MV_3Dpw-BRY',
            title: rec.title,
            artist: `${rec.artist} • ${rec.reason || 'AI DJ Mix'}`,
            cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
            duration: '3:30',
            seconds: 210,
          });
          showToast(`AI DJ: Now Playing ${rec.title}`);
        }
      } catch (err) {
        console.warn('AI DJ error:', err);
      } finally {
        setIsAiLoading(false);
      }
    } else {
      toggleAiDj();
      showToast('AI DJ Paused');
    }
  };

  const getTelemetryStatus = () => {
    let modeLabel = 'PUBLIC MODE';
    if (isAiDjActive) {
      modeLabel = 'AI DJ ACTIVE';
    } else {
      const currentMode = mode || privacyMode;
      if (currentMode === 'private') {
        modeLabel = 'PRIVATE SESSION';
      }
    }
    return `${modeLabel} • LOCAL ${localTime || '12:00:00'}`;
  };

  const currentMode = mode || privacyMode;

  return (
    <header className="relative z-30 flex flex-wrap items-center justify-between gap-3 px-5 pt-2 pb-2">
      {/* Left: Compact Editorial Wordmark (non-home routes) + Frosted Pill Search + Green "Start AI DJ" Pill */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Compact Wordmark replacing round logo on non-home routes */}
        {!isHome && (
          <div className="mr-1">
            <Wordmark variant="compact" />
          </div>
        )}

        {/* Frosted Pill Search Input Form */}
        <form
          onSubmit={handleSearchSubmit}
          className="sc-pill flex items-center gap-2.5 px-4 h-10 w-[240px] sm:w-[310px] focus-within:border-white/30 focus-within:bg-black/80"
        >
          <Search className="w-4 h-4 text-[#8A8A8E] shrink-0" aria-hidden="true" />
          <input
            ref={searchInputRef}
            id="global-search"
            type="text"
            value={searchVal}
            onChange={(e) => setTypedVal(e.target.value)}
            placeholder="What do you want to play?"
            aria-label="Global music search"
            className="bg-transparent border-none outline-none text-xs text-[#F4F4F2] placeholder-[#8A8A8E] w-full font-normal"
          />
          <kbd className="hidden sm:inline-block meta-label text-[9px] text-[#8A8A8E] bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
            ⌘K
          </kbd>
        </form>

        {/* Green "Start AI DJ" Pill with Sparkle Icon */}
        <button
          id="ai-dj-btn"
          onClick={handleAiDjClick}
          aria-label={isAiDjActive ? 'Pause AI DJ' : 'Start AI DJ'}
          className="h-10 px-4 rounded-full bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C] font-medium text-xs flex items-center gap-2 shadow-[0_0_24px_rgba(30,215,96,0.35)] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
        >
          {isAiLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
          )}
          <span id="ai-dj-label" className="font-semibold tracking-tight">
            {isAiDjActive ? 'AI DJ Live' : 'Start AI DJ'}
          </span>
        </button>
      </div>

      {/* Center Active Mode Pill (Dark OLED Pill) */}
      <div id="ai-status-banner" className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 sc-pill shadow-[0_4px_20px_rgba(0,0,0,0.85)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1ED760] glow-green-sm animate-pulse" aria-hidden="true" />
        <span id="mode-telemetry" className="meta-label text-[#F4F4F2]/90">
          {getTelemetryStatus()}
        </span>
      </div>

      {/* Right: Segmented Pill "Public | Private" + Utility Pill */}
      <div className="flex items-center gap-2.5">
        {/* Segmented Pill: Public | Private */}
        <div className="sc-pill p-1 flex items-center h-10">
          <button
            id="btn-mode-public"
            onClick={() => { setMode('public'); setPrivacyMode('public'); }}
            aria-label="Set session mode to public"
            className={`h-8 px-3.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              currentMode === 'public'
                ? 'bg-[#F4F4F2] text-[#0B0B0C] shadow-sm font-semibold'
                : 'text-[#8A8A8E] hover:text-[#F4F4F2]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Public</span>
          </button>
          <button
            id="btn-mode-private"
            onClick={() => { setMode('private'); setPrivacyMode('private'); }}
            aria-label="Set session mode to private"
            className={`h-8 px-3.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              currentMode === 'private'
                ? 'bg-[#F4F4F2] text-[#0B0B0C] shadow-sm font-semibold'
                : 'text-[#8A8A8E] hover:text-[#F4F4F2]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Private</span>
          </button>
        </div>

        {/* Dark Utility Pill with Popovers */}
        <div className="relative flex items-center gap-2">
          <div className="sc-pill h-10 px-2.5 flex items-center gap-2">
            {/* Notification Bell with Popover Trigger */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => { setIsNotifOpen((prev) => !prev); setIsSettingsOpen(false); }}
                aria-label="Notifications"
                className="relative w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-[#F4F4F2]/85 hover:text-white transition cursor-pointer"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#1ED760] ring-2 ring-[#141416]" />
              </button>
              {isNotifOpen && <NotificationsPopover />}
            </div>

            {/* Settings Gear with Popover Trigger */}
            <div ref={settingsRef} className="relative">
              <button
                onClick={() => { setIsSettingsOpen((prev) => !prev); setIsNotifOpen(false); }}
                aria-label="Settings"
                className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-[#F4F4F2]/85 hover:text-white transition cursor-pointer"
              >
                <Settings className="w-4 h-4" aria-hidden="true" />
              </button>
              {isSettingsOpen && (
                <QuickSettingsPopover
                  currentMode={currentMode}
                  onClose={() => setIsSettingsOpen(false)}
                />
              )}
            </div>

            {/* User Avatar */}
            <button
              onClick={() => navigate('/library')}
              aria-label="Go to library profile"
              className="w-7 h-7 rounded-full overflow-hidden border border-white/25 hover:border-[#1ED760] transition cursor-pointer"
            >
              <CoverImage
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80"
                alt=""
                iconSize="w-3.5 h-3.5"
                className="w-full h-full object-cover grayscale contrast-125"
              />
            </button>
          </div>
        </div>

        {/* Separate Circular Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          aria-label="Toggle Fullscreen"
          className="sc-pill w-10 h-10 flex items-center justify-center text-[#F4F4F2]/80 hover:text-white cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
