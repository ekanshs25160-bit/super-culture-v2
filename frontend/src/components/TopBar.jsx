import { useContext, useEffect, useRef } from 'react';
import { AudioContext } from '../context/AudioContext';

export default function TopBar() {
  const {
    showToast,
    isAiDjActive,
    toggleAiDj,
    privacyMode,
    setPrivacyMode,
  } = useContext(AudioContext);

  const searchInputRef = useRef(null);

  // ⌘K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      showToast('Entered Fullscreen Canvas');
    } else {
      document.exitFullscreen().catch(() => {});
      showToast('Exited Fullscreen Canvas');
    }
  };

  const getTelemetryStatus = () => {
    if (isAiDjActive) {
      return 'AI DJ ACTIVE • MIXING ARCHIVE CUTS';
    }
    if (privacyMode === 'private') {
      return 'PRIVATE SESSION • INCOGNITO AUDIO';
    }
    return 'PUBLIC MODE • CURATED ARCHIVE';
  };

  return (
    <header className="relative z-30 flex flex-wrap items-center justify-between gap-3 px-5 pt-2 pb-2">
      {/* Left: Round White Logo + Frosted Pill Search + Green "Start AI DJ" Pill */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Round White Editorial Logo */}
        <button
          onClick={() => showToast('Super Culture Audio Engine • Home View')}
          title="Super Culture Home"
          className="w-10 h-10 rounded-full bg-[#F4F4F2] text-[#0B0B0C] flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 9.5c4.5-2.5 11.5-2.5 16 0" />
            <path d="M5.5 13c3.8-2 9.2-2 13 0" />
            <path d="M7.5 16.2c2.5-1.2 6.5-1.2 9 0" />
          </svg>
        </button>

        {/* Frosted Pill Search Input */}
        <div className="sc-pill flex items-center gap-2.5 px-4 h-10 w-[240px] sm:w-[310px] focus-within:border-white/30 focus-within:bg-black/80">
          <svg className="w-4 h-4 text-[#8A8A8E] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={searchInputRef}
            id="global-search"
            type="text"
            placeholder="What do you want to play?"
            className="bg-transparent border-none outline-none text-xs text-[#F4F4F2] placeholder-[#8A8A8E] w-full font-normal"
          />
          <kbd className="hidden sm:inline-block meta-label text-[9px] text-[#8A8A8E] bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
            ⌘K
          </kbd>
        </div>

        {/* Green "Start AI DJ" Pill with Sparkle Icon */}
        <button
          id="ai-dj-btn"
          onClick={toggleAiDj}
          className="h-10 px-4 rounded-full bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C] font-medium text-xs flex items-center gap-2 shadow-[0_0_24px_rgba(30,215,96,0.35)] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
          </svg>
          <span id="ai-dj-label" className="font-semibold tracking-tight">
            {isAiDjActive ? 'AI DJ Live' : 'Start AI DJ'}
          </span>
        </button>
      </div>

      {/* Center Active Mode Pill (Dark OLED Pill) */}
      <div id="ai-status-banner" className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 sc-pill shadow-[0_4px_20px_rgba(0,0,0,0.85)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1ED760] glow-green-sm animate-pulse"></span>
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
            onClick={() => setPrivacyMode('public')}
            className={`h-8 px-3.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              privacyMode === 'public'
                ? 'bg-[#F4F4F2] text-[#0B0B0C] shadow-sm'
                : 'text-[#8A8A8E] hover:text-[#F4F4F2]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span>Public</span>
          </button>
          <button
            id="btn-mode-private"
            onClick={() => setPrivacyMode('private')}
            className={`h-8 px-3.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              privacyMode === 'private'
                ? 'bg-[#F4F4F2] text-[#0B0B0C] shadow-sm'
                : 'text-[#8A8A8E] hover:text-[#F4F4F2]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <rect x="4" y="11" width="16" height="9" rx="2" />
              <path strokeLinecap="round" d="M8 11V7a4 4 0 018 0v4" />
            </svg>
            <span>Private</span>
          </button>
        </div>

        {/* Dark Utility Pill */}
        <div className="sc-pill h-10 px-2.5 flex items-center gap-2">
          {/* Notification Bell with Green Dot */}
          <button
            onClick={() => showToast('3 new vinyl drops & 2 Jam Room invites')}
            title="Notifications"
            className="relative w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-[#F4F4F2]/85 hover:text-white transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#1ED760] ring-2 ring-[#141416]"></span>
          </button>

          {/* Settings Gear */}
          <button
            onClick={() => showToast('Audio Settings: 24-Bit/96kHz CoreAudio Output')}
            title="Settings"
            className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-[#F4F4F2]/85 hover:text-white transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>

          {/* User Avatar */}
          <button
            onClick={() => showToast('Signed in as Sora Takahashi • Super Culture Member')}
            title="Profile: Sora Takahashi"
            className="w-7 h-7 rounded-full overflow-hidden border border-white/25 hover:border-[#1ED760] transition cursor-pointer"
          >
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80"
              alt="User Avatar"
              className="w-full h-full object-cover grayscale contrast-125"
            />
          </button>
        </div>

        {/* Separate Circular Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          title="Toggle Fullscreen"
          className="sc-pill w-10 h-10 flex items-center justify-center text-[#F4F4F2]/80 hover:text-white cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      </div>
    </header>
  );
}

