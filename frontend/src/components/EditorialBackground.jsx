import { useState, useEffect } from 'react';

export default function EditorialBackground() {
  const [localTime, setLocalTime] = useState('');

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      // Local 24h clock string
      const timeStr = now.toTimeString().split(' ')[0];
      setLocalTime(`LOCAL ${timeStr}`);
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* LAYER 0: FULL-BLEED "SUPER CULTURE" EDITORIAL BACKGROUND */}
      <div className="absolute inset-0 z-0 overflow-hidden select-none pointer-events-none">
        <div className="absolute inset-0 bg-[#0B0B0C]">
          <img
            src="/background.png"
            alt="Super Culture Editorial Background"
            className="w-full h-full object-cover object-center"
          />
          {/* Subtle dark overlay for UI legibility without blurring photography */}
          <div className="absolute inset-0 bg-black/25"></div>
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
