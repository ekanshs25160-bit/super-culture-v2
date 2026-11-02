import { useState, useEffect } from 'react';

export default function EditorialBackground() {
  const [localTime, setLocalTime] = useState('');
  const [laxTime, setLaxTime] = useState('');
  const [ldnTime, setLdnTime] = useState('');

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();

      // Local 24h clock string
      const timeStr = now.toTimeString().split(' ')[0];
      setLocalTime(`LOCAL ${timeStr}`);

      // LAX (Pacific Time)
      try {
        const laxStr = now.toLocaleTimeString('en-US', {
          timeZone: 'America/Los_Angeles',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        setLaxTime(laxStr);
      } catch {
        setLaxTime('7:56 AM');
      }

      // LDN (London / GMT / BST)
      try {
        const ldnStr = now.toLocaleTimeString('en-US', {
          timeZone: 'Europe/London',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        setLdnTime(ldnStr);
      } catch {
        setLdnTime('3:56 PM');
      }
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* LAYER 0: FULL-BLEED "SUPER CULTURE" BACKGROUND */}
      <div className="absolute inset-0 z-0 overflow-hidden select-none pointer-events-none">
        {/* Black & White Editorial Photo Backdrop */}
        <div className="absolute inset-0 bg-[#0B0B0C]">
          {/* Base B&W Photograph */}
          <img
            src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=2000&q=85"
            alt=""
            className="w-full h-full object-cover object-center grayscale contrast-125 brightness-[0.38] opacity-55 mix-blend-luminosity scale-105"
          />
          {/* Secondary B&W portrait layer showing editorial crew */}
          <img
            src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1920&q=85"
            alt="Super Culture Editorial Crew"
            className="absolute inset-0 w-full h-full object-cover object-[center_28%] grayscale contrast-[1.28] brightness-[0.58] opacity-85"
          />

          {/* Custom Editorial Silhouette & Vignette Overlay */}
          <svg
            className="absolute inset-0 w-full h-full opacity-45 mix-blend-multiply"
            viewBox="0 0 1440 1024"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <radialGradient id="vignette" cx="50%" cy="46%" r="58%">
                <stop offset="0%" stopColor="#0B0B0C" stopOpacity="0.12" />
                <stop offset="70%" stopColor="#0B0B0C" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#0B0B0C" stopOpacity="0.82" />
              </radialGradient>
            </defs>
            <rect width="1440" height="1024" fill="url(#vignette)" />
          </svg>

          {/* Light dark overlay for UI legibility while keeping background crisp & unblurred */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B0B0C]/30 via-[#0B0B0C]/15 to-[#0B0B0C]/60"></div>
        </div>

        {/* Thin White Architectural Grid Lines */}
        <div className="editorial-grid-line-v" style={{ left: '4.5%' }}></div>
        <div className="editorial-grid-line-v" style={{ left: '20.5%' }}></div>
        <div className="editorial-grid-line-v" style={{ left: '35.5%' }}></div>
        <div className="editorial-grid-line-v" style={{ left: '50.2%' }}></div>
        <div className="editorial-grid-line-v" style={{ left: '65.0%' }}></div>
        <div className="editorial-grid-line-v" style={{ left: '79.8%' }}></div>
        <div className="editorial-grid-line-v" style={{ left: '95.5%' }}></div>

        <div className="editorial-grid-line-h" style={{ top: '8.5%' }}></div>
        <div className="editorial-grid-line-h" style={{ top: '48.0%' }}></div>
        <div className="editorial-grid-line-h" style={{ top: '63.5%' }}></div>
        <div className="editorial-grid-line-h" style={{ top: '66.2%' }}></div>
        <div className="editorial-grid-line-h" style={{ top: '88.5%' }}></div>

        {/* GIANT WHITE SERIF WORDMARK: "Super culture" */}
        <div className="absolute inset-x-0 top-[74px] md:top-[82px] flex flex-col items-center justify-center pointer-events-none z-10 px-4">
          <div className="relative w-full max-w-[820px] select-none">
            {/* Italic "Super" */}
            <h1 className="super-wordmark-italic text-[#F4F4F2] text-[88px] sm:text-[132px] lg:text-[168px] xl:text-[184px] drop-shadow-[0_12px_36px_rgba(0,0,0,0.65)] ml-[2%] sm:ml-[6%]">
              Super
            </h1>
            {/* Upright "culture" */}
            <h2 className="super-wordmark-upright text-[#F4F4F2] text-[90px] sm:text-[138px] lg:text-[174px] xl:text-[192px] -mt-4 sm:-mt-7 lg:-mt-9 ml-[16%] sm:ml-[24%] drop-shadow-[0_14px_40px_rgba(0,0,0,0.75)]">
              culture
            </h2>
          </div>
        </div>

        {/* BACKGROUND EDITORIAL MONOSPACE MICRO-LABELS */}
        <div className="hidden lg:flex items-center justify-center w-6 h-6 rounded-full border border-white/60 text-white/80 font-serif text-xs absolute left-[4.5%] top-[63.7%] -translate-x-1/2">
          §
        </div>
        <div className="hidden lg:block meta-label text-white/65 underline decoration-white/30 underline-offset-4 absolute left-[20.7%] top-[64.1%]">
          ABOUT
        </div>
        <div className="hidden lg:block meta-label text-white/65 underline decoration-white/30 underline-offset-4 absolute left-[35.7%] top-[64.1%]">
          WORK
        </div>
        <div className="hidden lg:block meta-label text-white/65 underline decoration-white/30 underline-offset-4 absolute left-[50.4%] top-[64.1%]">
          SELECTS
        </div>
        <div className="hidden lg:block meta-label text-white/65 absolute left-[65.3%] top-[63.9%] leading-relaxed">
          <div>LAX — <span>{laxTime || '7:56 AM'}</span></div>
          <div>LDN — <span>{ldnTime || '3:56 PM'}</span></div>
        </div>
        <div className="hidden lg:block meta-label text-white/65 text-right absolute right-[4.7%] top-[63.9%] leading-relaxed">
          <div className="underline decoration-white/30 underline-offset-4">LIGHTMODE: OFF</div>
          <div className="underline decoration-white/30 underline-offset-4">GRID: ON</div>
        </div>
        <div className="hidden lg:block meta-label text-white/65 absolute left-[65.3%] top-[59.2%] leading-tight">
          CREATIVE STUDIO,<br />FASHION HOUSE
        </div>

        {/* Ambient audio mute/sound indicator */}
        <div className="hidden xl:flex items-center justify-center w-9 h-9 rounded-full bg-black/55 border border-white/15 text-white/75 absolute left-[28.2%] top-[56.5%]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" />
          </svg>
        </div>
      </div>

      {/* CORNER TELEMETRY LABELS (Dark OLED Badges) */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-2.5 pb-0 pointer-events-none">
        <div className="sc-pill px-3 py-1 bg-black/85 backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#1ED760] glow-green-sm"></span>
          <span className="meta-label text-[#F4F4F2]/80">SUPER CULTURE / MUSIC OS 04</span>
        </div>
        <div className="sc-pill px-3 py-1 bg-black/85 backdrop-blur-md border border-white/10 hidden sm:flex items-center gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
          <span className="meta-label text-[#F4F4F2]/80">24-BIT / 96KHZ LOSSLESS</span>
          <span className="text-white/20">•</span>
          <span className="meta-label text-[#1ED760] font-mono">{localTime || 'LOCAL 19:22:08'}</span>
        </div>
      </div>
    </>
  );
}

