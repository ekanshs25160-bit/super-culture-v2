import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, X } from 'lucide-react';
import {
  UPDATE_DISMISSED_KEY,
  checkForUpdate,
  openExternal,
} from '../services/updateService';

/** Non-intrusive startup banner (native builds only). Network check is cached for 12h. */
export default function UpdateBanner() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let cancelled = false;
    checkForUpdate().then((res) => {
      if (cancelled || !res?.hasUpdate) return;
      try {
        if (localStorage.getItem(UPDATE_DISMISSED_KEY) === res.latestVersion) return;
      } catch {
        /* ignore */
      }
      setInfo(res);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(UPDATE_DISMISSED_KEY, info.latestVersion);
    } catch {
      /* ignore */
    }
    setInfo(null);
  };

  return (
    <div
      role="status"
      className="relative z-40 mx-3 mt-1 shrink-0 flex items-center gap-2 rounded-xl bg-[#1ED760]/10 border border-[#1ED760]/30 px-3 py-1.5"
    >
      <p className="flex-1 min-w-0 text-xs text-[#F4F4F2] truncate">
        Update v{info.latestVersion} available
      </p>
      <button
        onClick={() => openExternal(info.apkUrl || info.releaseUrl)}
        aria-label="Download latest APK"
        className="shrink-0 min-h-[32px] px-3 rounded-full bg-[#1ED760] text-[#0B0B0C] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
      >
        <Download className="w-3 h-3" aria-hidden="true" />
        Update
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss update banner"
        className="shrink-0 min-w-[32px] min-h-[32px] rounded-full flex items-center justify-center text-[#8A8A8E] hover:text-white cursor-pointer"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
