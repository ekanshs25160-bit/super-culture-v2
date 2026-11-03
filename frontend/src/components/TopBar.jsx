import { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, Settings, Maximize2, Minimize2, Globe, Lock } from 'lucide-react';
import { AudioContext } from '../context/AudioContext';
import { useLibraryStore } from '../store/useLibraryStore';
import { useUiStore } from '../store/useUiStore';
import { NotificationsPopover, QuickSettingsPopover } from './TopBarPopovers';
import Wordmark from './Wordmark';
import CoverImage from './shared/CoverImage';

export default function TopBar() {
  const location = useLocation();
  const { privacyMode, setPrivacyMode, isAiDjActive } = useContext(AudioContext);
  const { mode, setMode } = useLibraryStore();
  const { isMobileMenuOpen, toggleMobileMenu } = useUiStore();

  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const [typedVal, setTypedVal] = useState(null);
  const qParam = location.pathname === '/search'
    ? new URLSearchParams(location.search).get('q') || ''
    : '';
  const searchVal = typedVal !== null ? typedVal : qParam;
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
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

  // Track Fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
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
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const getTelemetryStatus = () => {
    let modeLabel = 'PUBLIC MODE';
    if (isAiDjActive) {
      modeLabel = 'AI DJ ACTIVE';
    } else {
      const active = mode || privacyMode;
      if (active === 'private') {
        modeLabel = 'PRIVATE SESSION';
      }
    }
    return `${modeLabel} • LOCAL ${localTime || '12:00:00'}`;
  };

  const currentMode = mode || privacyMode;

  return (
    <header className="relative z-30 flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 pt-2 pb-2">
      {/* Left: Hamburger (Mobile) + Wordmark + Frosted Pill Search */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        {/* Animated Hamburger-to-Cross Button (Mobile/Tablet only) */}
        <button
          onClick={toggleMobileMenu}
          aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="lg:hidden w-9 h-9 sc-pill flex items-center justify-center text-[#F4F4F2] transition cursor-pointer shrink-0"
        >
          <div className="relative w-4 h-3.5 flex flex-col justify-between">
            <span
              className={`block h-0.5 w-full bg-white rounded-full transition-all duration-300 origin-center ${
                isMobileMenuOpen ? 'rotate-45 translate-y-[5.5px]' : ''
              }`}
            />
            <span
              className={`block h-0.5 w-full bg-white rounded-full transition-all duration-300 ${
                isMobileMenuOpen ? 'opacity-0 scale-x-0' : 'opacity-100'
              }`}
            />
            <span
              className={`block h-0.5 w-full bg-white rounded-full transition-all duration-300 origin-center ${
                isMobileMenuOpen ? '-rotate-45 -translate-y-[5.5px]' : ''
              }`}
            />
          </div>
        </button>

        {/* Compact Editorial Wordmark */}
        <div className="shrink-0 mr-0.5">
          <Wordmark variant="compact" />
        </div>

        {/* Frosted Pill Search Input Form */}
        <form
          onSubmit={handleSearchSubmit}
          className="sc-pill flex items-center gap-2 px-3 sm:px-4 h-9 sm:h-10 w-[140px] xs:w-[180px] sm:w-[260px] md:w-[310px] focus-within:border-white/30 focus-within:bg-black/80"
        >
          <Search className="w-3.5 h-3.5 text-[#8A8A8E] shrink-0" aria-hidden="true" />
          <input
            ref={searchInputRef}
            id="global-search"
            type="text"
            value={searchVal}
            onChange={(e) => setTypedVal(e.target.value)}
            placeholder="Search catalog..."
            aria-label="Global music search"
            className="bg-transparent border-none outline-none text-xs text-[#F4F4F2] placeholder-[#8A8A8E] w-full font-normal"
          />
          <kbd className="hidden md:inline-block meta-label text-[9px] text-[#8A8A8E] bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
            ⌘K
          </kbd>
        </form>
      </div>

      {/* Center Active Mode Pill (Desktop OLED Pill) */}
      <div id="ai-status-banner" className="hidden xl:flex items-center gap-2.5 px-3.5 py-1.5 sc-pill shadow-[0_4px_20px_rgba(0,0,0,0.85)] shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1ED760] glow-green-sm animate-pulse" aria-hidden="true" />
        <span id="mode-telemetry" className="meta-label text-[#F4F4F2]/90">
          {getTelemetryStatus()}
        </span>
      </div>

      {/* Right: Segmented Pill "Public | Private" + Utility Pill + Fullscreen */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Segmented Pill: Public | Private (Hidden on small mobile) */}
        <div className="hidden sm:flex sc-pill p-1 items-center h-9 sm:h-10">
          <button
            id="btn-mode-public"
            onClick={() => { setMode('public'); setPrivacyMode('public'); }}
            aria-label="Set session mode to public"
            className={`h-7 sm:h-8 px-2.5 sm:px-3.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
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
            className={`h-7 sm:h-8 px-2.5 sm:px-3.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
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
        <div className="relative flex items-center gap-1.5">
          <div className="sc-pill h-9 sm:h-10 px-2 sm:px-2.5 flex items-center gap-1.5 sm:gap-2">
            {/* Notification Bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => { setIsNotifOpen((prev) => !prev); setIsSettingsOpen(false); }}
                aria-label="Notifications"
                className="relative w-6 h-6 sm:w-7 sm:h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-[#F4F4F2]/85 hover:text-white transition cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#1ED760] ring-2 ring-[#141416]" />
              </button>
              {isNotifOpen && <NotificationsPopover />}
            </div>

            {/* Settings Gear */}
            <div ref={settingsRef} className="relative">
              <button
                onClick={() => { setIsSettingsOpen((prev) => !prev); setIsNotifOpen(false); }}
                aria-label="Settings"
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-[#F4F4F2]/85 hover:text-white transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
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
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden border border-white/25 hover:border-[#1ED760] transition cursor-pointer"
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

        {/* Fullscreen Button in TopBar */}
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          className="sc-pill w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[#F4F4F2]/80 hover:text-white transition cursor-pointer"
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}
