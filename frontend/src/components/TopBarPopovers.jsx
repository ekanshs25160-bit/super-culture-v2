import React from 'react';
import { useNavigate } from 'react-router-dom';

export function NotificationsPopover() {
  return (
    <div className="sc-card p-3.5 absolute right-0 top-11 z-50 w-72 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.85)] rounded-2xl animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <span className="meta-label text-[9px] text-[#F4F4F2]">NOTIFICATIONS</span>
        <span className="meta-label text-[8px] text-[#8A8A8E]">0 UNREAD</span>
      </div>
      <div className="py-4 text-center">
        <p className="text-xs text-[#8A8A8E]">No new notifications</p>
      </div>
    </div>
  );
}

export function QuickSettingsPopover({ currentMode, onClose }) {
  const navigate = useNavigate();

  return (
    <div className="sc-card p-3.5 absolute right-0 top-11 z-50 w-72 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.85)] rounded-2xl animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <span className="meta-label text-[9px] text-[#F4F4F2]">QUICK SETTINGS</span>
        <span className="meta-label text-[8px] text-[#1ED760]">HI-RES 24-BIT</span>
      </div>
      <div className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#F4F4F2]">Lossless Audio</span>
          <span className="text-[10px] text-[#1ED760] font-mono">96kHz FLAC</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#F4F4F2]">Session Mode</span>
          <span className="text-[10px] text-[#8A8A8E] capitalize">{currentMode}</span>
        </div>
        <button
          onClick={() => {
            onClose();
            navigate('/settings');
          }}
          aria-label="Open full settings page"
          className="w-full mt-2 py-1.5 rounded-xl bg-white/10 hover:bg-[#1ED760] hover:text-black text-center text-xs font-medium text-[#F4F4F2] transition cursor-pointer"
        >
          Open Full Settings ↗
        </button>
      </div>
    </div>
  );
}

