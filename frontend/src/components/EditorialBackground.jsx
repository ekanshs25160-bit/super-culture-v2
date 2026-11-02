import { useLocation } from 'react-router-dom';
import Wordmark from './Wordmark';

/**
 * EditorialBackground
 * Solid #0B0B0C background with faint hairline grid aligned to layout columns,
 * film-grain overlay, and live hero wordmark on Home route.
 */
export default function EditorialBackground() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden select-none pointer-events-none bg-[#0B0B0C]"
      aria-hidden="true"
    >
      {/* 1. Hairline grid aligned to 12-column layout */}
      <div className="absolute inset-0 grid grid-cols-1 lg:grid-cols-12 gap-3 px-5 pointer-events-none">
        {/* Left column hairline divider */}
        <div className="hidden lg:block lg:col-span-4 xl:col-span-3 h-full border-r border-white/[0.04]" />

        {/* Center column open area */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-6 h-full relative flex flex-col items-center justify-center overflow-hidden">
          {/* Subtle interior vertical hairline guides */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/[0.02]" />

          {/* Live Hero Wordmark (Home only) */}
          {isHome && (
            <div className="w-full flex items-center justify-center pt-8 pb-52 xl:pb-56 px-4">
              <Wordmark variant="hero" />
            </div>
          )}
        </div>

        {/* Right column hairline divider */}
        <div className="hidden xl:block xl:col-span-3 h-full border-l border-white/[0.04]" />
      </div>

      {/* 2. Film Grain Texture Overlay (opacity <= 0.04) */}
      <div className="absolute inset-0 film-grain opacity-[0.035] pointer-events-none" />
    </div>
  );
}
