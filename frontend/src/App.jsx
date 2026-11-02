import { useEffect, useContext } from 'react';
import { useLocation, Routes, Route, Outlet } from 'react-router-dom';
import { AudioProvider, AudioContext } from './context/AudioContext';
import { useJamStore } from './store/useJamStore';
import YouTubePlayer from './components/YouTubePlayer';
import EditorialBackground from './components/EditorialBackground';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import PlayerBar from './components/PlayerBar';

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

/**
 * Main App Layout Shell:
 * Background, TopBar, LeftSidebar, RightSidebar, and PlayerBar remain permanently
 * mounted across all route transitions so audio playback and session state never interrupt.
 */
function AppLayout() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const { playTrack, togglePlay, seekTo, isPlaying } = useContext(AudioContext);
  const registerAudioSyncHandlers = useJamStore((s) => s.registerAudioSyncHandlers);

  // Synchronize remote Host commands across WebSocket to the local audio engine
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
      {/* Layer 0: Full-Bleed Editorial Background & Corner Telemetry */}
      <EditorialBackground />

      {/* 1. Top Bar (Floating, No Background Strip) */}
      <TopBar />

      {/* Middle Spatial Workspace: Left Column | Center Canvas (<Outlet/>) | Right Column */}
      <main className="relative z-20 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 px-5 pt-1 pb-2 items-start pointer-events-none min-h-0 overflow-hidden">
        {/* 2. Left Column (collapses below 1024px) */}
        <div className="hidden lg:flex lg:col-span-4 xl:col-span-3 h-full min-h-0 pointer-events-auto">
          <LeftSidebar />
        </div>

        {/* Center Canvas (<Outlet />): Dynamic width expanding as sidebars collapse */}
        <div
          className={`col-span-12 lg:col-span-8 xl:col-span-6 h-full flex flex-col ${
            isHome ? 'justify-end items-center' : 'justify-start'
          } pb-2 pointer-events-auto min-h-0 overflow-hidden w-full`}
        >
          <Outlet />
        </div>

        {/* 3. Right Column (collapses below 1280px first) */}
        <div className="hidden xl:flex xl:col-span-3 h-full min-h-0 pointer-events-auto">
          <RightSidebar />
        </div>
      </main>

      {/* 4. Fixed Audio Player Bar at bottom */}
      <PlayerBar />
    </div>
  );
}

export default function App() {
  return (
    <AudioProvider>
      {/* Headless 1×1px offscreen YouTube IFrame */}
      <YouTubePlayer />

      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchView />} />
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
