import { useEffect, useContext, useState } from 'react';
import { useLocation, Routes, Route, Outlet } from 'react-router-dom';
import { X, Library, Radio } from 'lucide-react';
import { AudioProvider, AudioContext } from './context/AudioContext';
import { useJamStore } from './store/useJamStore';
import { useUiStore } from './store/useUiStore';
import YouTubePlayer from './components/YouTubePlayer';
import EditorialBackground from './components/EditorialBackground';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import PlayerBar from './components/PlayerBar';
import { AddToPlaylistModal } from './components/shared';

// Page Views
import Home from './pages/Home';
import SearchView from './pages/SearchView';
import MagicVibeView from './pages/MagicVibeView';
import RecentsView from './pages/RecentsView';
import FollowedView from './pages/FollowedView';
import DownloadedView from './pages/DownloadedView';
import LibraryView from './pages/LibraryView';
import PlaylistView from './pages/PlaylistView';
import GenreView from './pages/GenreView';
import JamRoomView from './pages/JamRoomView';
import SettingsView from './pages/SettingsView';
import ArtistView from './pages/ArtistView';

function AppLayout() {
  const location = useLocation();
  const { playTrack, togglePlay, seekTo, isPlaying } = useContext(AudioContext);
  const registerAudioSyncHandlers = useJamStore((s) => s.registerAudioSyncHandlers);
  const { isMobileMenuOpen, closeMobileMenu } = useUiStore();
  const [mobileTab, setMobileTab] = useState('nav');

  // Close mobile drawer on route transition
  useEffect(() => {
    closeMobileMenu();
  }, [location.pathname, closeMobileMenu]);

  // Synchronize remote Host commands across WebSocket
  useEffect(() => {
    registerAudioSyncHandlers({
      onRemotePlay: () => {
        if (!isPlaying) togglePlay();
      },
      onRemotePause: () => {
        if (isPlaying) togglePlay();
      },
      onRemoteSeek: (pos) => {
        if (typeof pos === 'number') seekTo(pos);
      },
      onRemoteTrackChange: (track) => {
        if (track) playTrack(track);
      },
    });
  }, [isPlaying, togglePlay, seekTo, playTrack, registerAudioSyncHandlers]);

  return (
    <div
      id="app-canvas"
      className="relative w-full h-[100dvh] max-h-[100dvh] bg-[#0B0B0C] overflow-hidden flex flex-col justify-between select-none"
    >
      {/* Layer 0: Background & Hairline Grid */}
      <EditorialBackground />

      {/* 1. Top Bar */}
      <TopBar />

      {/* 2. Middle Spatial Workspace */}
      <main className="relative z-20 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 px-3 sm:px-5 pt-1 pb-2 items-start pointer-events-none min-h-0 overflow-hidden">
        {/* Left Column (Desktop only) */}
        <div className="hidden lg:flex lg:col-span-4 xl:col-span-3 h-full min-h-0 pointer-events-auto">
          <LeftSidebar />
        </div>

        {/* Center Canvas */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-6 h-full flex flex-col justify-start pb-2 pointer-events-auto min-h-0 overflow-hidden w-full">
          <Outlet />
        </div>

        {/* Right Column (Large desktop only) */}
        <div className="hidden xl:flex xl:col-span-3 h-full min-h-0 pointer-events-auto">
          <RightSidebar />
        </div>
      </main>

      {/* 3. Mobile Slide-Over Glassmorphic Drawer (< lg) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            onClick={closeMobileMenu}
            className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-[85vw] max-w-[340px] h-full bg-[#0B0B0C]/95 border-r border-white/10 p-4 overflow-hidden flex flex-col gap-3 shadow-2xl z-10 animate-in slide-in-from-left duration-300">
            {/* Drawer Header with Close Button */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
              <span className="meta-label text-[10px] text-[#1ED760]">NAVIGATION & SOCIAL</span>
              <button
                onClick={closeMobileMenu}
                aria-label="Close navigation menu"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-[#F4F4F2] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Switcher: "Library & Nav" | "Jam & Social" */}
            <div className="sc-pill p-1 flex items-center shrink-0">
              <button
                onClick={() => setMobileTab('nav')}
                className={`flex-1 py-1.5 rounded-full text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  mobileTab === 'nav'
                    ? 'bg-[#F4F4F2] text-[#0B0B0C] font-semibold shadow-sm'
                    : 'text-[#8A8A8E] hover:text-[#F4F4F2]'
                }`}
              >
                <Library className="w-3.5 h-3.5" />
                <span>Library & Nav</span>
              </button>
              <button
                onClick={() => setMobileTab('social')}
                className={`flex-1 py-1.5 rounded-full text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  mobileTab === 'social'
                    ? 'bg-[#F4F4F2] text-[#0B0B0C] font-semibold shadow-sm'
                    : 'text-[#8A8A8E] hover:text-[#F4F4F2]'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Jam & Social</span>
              </button>
            </div>

            {/* Active Drawer View Content */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
              {mobileTab === 'nav' ? <LeftSidebar /> : <RightSidebar />}
            </div>
          </div>
        </div>
      )}

      {/* 4. Fixed Audio Player Bar */}
      <PlayerBar />

      {/* 5. Global Add to Playlist Modal */}
      <AddToPlaylistModal />
    </div>
  );
}

export default function App() {
  return (
    <AudioProvider>
      <YouTubePlayer />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchView />} />
          <Route path="/artist/:artistName" element={<ArtistView />} />
          <Route path="/magic-vibe" element={<MagicVibeView />} />
          <Route path="/recents" element={<RecentsView />} />
          <Route path="/followed" element={<FollowedView />} />
          <Route path="/downloaded" element={<DownloadedView />} />
          <Route path="/library" element={<LibraryView />} />
          <Route path="/library/:playlistId" element={<PlaylistView />} />
          <Route path="/genre/:genreId" element={<GenreView />} />
          <Route path="/jam/:roomId" element={<JamRoomView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Route>
      </Routes>
    </AudioProvider>
  );
}
