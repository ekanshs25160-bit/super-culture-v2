import { useLocation, Routes, Route } from 'react-router-dom';
import { AudioProvider } from './context/AudioContext';
import YouTubePlayer from './components/YouTubePlayer';
import EditorialBackground from './components/EditorialBackground';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import BottomDiscoveryRow from './components/BottomDiscoveryRow';
import PlayerBar from './components/PlayerBar';
import GenreView from './pages/GenreView';

export default function App() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <AudioProvider>
      {/* Headless 1×1px offscreen YouTube IFrame */}
      <YouTubePlayer />

      {/* MAIN DESKTOP CANVAS (1440 x 1024 proportions, responsive to any desktop screen) */}
      <div
        id="app-canvas"
        className="relative w-full max-w-[1480px] min-h-screen xl:min-h-[980px] xl:h-[98vh] xl:max-h-[1040px] bg-[#0B0B0C] xl:rounded-[28px] overflow-hidden shadow-[0_35px_90px_rgba(0,0,0,0.95)] border border-white/10 flex flex-col justify-between"
      >
        {/* Layer 0: Full-Bleed Background, Grid Lines, Wordmark & Corner Telemetry */}
        <EditorialBackground />

        {/* 1. Top Bar (Floating, No Background Strip) */}
        <TopBar />

        {/* Middle Spatial Workspace: Left Column | Open Center Hero | Right Column */}
        <main className="relative z-20 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 px-5 pt-1 pb-2 items-start pointer-events-none min-h-0 overflow-hidden">
          {/* 2. Left Column */}
          <LeftSidebar />

          {/* Center Canvas */}
          <div
            className={`lg:col-span-6 h-full flex flex-col ${
              isHome ? 'justify-end items-center' : 'justify-start'
            } pb-2 pointer-events-auto min-h-0 overflow-hidden w-full`}
          >
            <Routes>
              <Route
                path="/"
                element={<div className="hidden lg:flex flex-1 pointer-events-none" />}
              />
              <Route path="/genre/:genreId" element={<GenreView />} />
            </Routes>
          </div>

          {/* 3. Right Column */}
          <RightSidebar />
        </main>

        {/* 4. Center-Bottom Row (Floating Above Player, only on Home) */}
        {isHome && <BottomDiscoveryRow />}

        {/* Spacer to prevent discovery row from being obscured by fixed PlayerBar */}
        {isHome && (
          <div className="h-24 md:h-20 shrink-0 pointer-events-none" aria-hidden="true" />
        )}

        {/* 5. Fixed Audio Player Bar at bottom */}
        <PlayerBar />
      </div>
    </AudioProvider>
  );
}
