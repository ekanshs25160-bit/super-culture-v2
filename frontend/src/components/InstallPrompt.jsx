import { useState } from 'react';
import { Download, Share, X, RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { usePwaInstall } from '../hooks/usePwaInstall';

const DISMISSED_KEY = 'super_culture_install_dismissed';

/**
 * In-app PWA install banner and update prompt
 */
export default function InstallPrompt() {
  const { canInstall, isIosSafari, isStandalone, promptInstall } = usePwaInstall();
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return Boolean(localStorage.getItem(DISMISSED_KEY));
    } catch {
      return false;
    }
  });

  // Service worker auto-update hook
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('[SW] Service worker registered:', r?.scope);
    },
    onRegisterError(error) {
      console.warn('[SW] Registration failed:', error);
    },
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // ignore storage error
    }
  };

  if (isStandalone) {
    // If running in standalone mode, only render update prompt if new version arrives
    if (!needRefresh) return null;
  }

  return (
    <>
      {/* 1. New Version Available Update Prompt */}
      {needRefresh && (
        <div
          role="alert"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md p-3.5 rounded-2xl bg-[#121215]/95 border border-[#1ED760]/30 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <RefreshCw className="w-4 h-4 text-[#1ED760] animate-spin shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#F4F4F2]">New Version Available</p>
              <p className="text-[11px] text-[#8A8A8E]">Reload to apply audio and performance updates.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-3 py-1.5 rounded-full bg-[#1ED760] text-[#0B0B0C] text-xs font-semibold hover:opacity-90 active:scale-95 transition cursor-pointer"
            >
              Reload
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="p-1 text-[#8A8A8E] hover:text-white transition"
              aria-label="Dismiss update"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. First-visit Install Prompt (Android / Desktop Chrome) */}
      {!isDismissed && canInstall && (
        <div
          role="dialog"
          aria-label="Install Super Culture application"
          className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md p-3.5 rounded-2xl bg-[#121215]/95 border border-white/15 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
              <Download className="w-4 h-4 text-[#1ED760]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#F4F4F2]">Install Super Culture</p>
              <p className="text-[11px] text-[#8A8A8E] truncate">Instant launch & background audio</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={promptInstall}
              className="px-3.5 py-1.5 rounded-full bg-[#F4F4F2] text-[#0B0B0C] text-xs font-semibold hover:scale-105 active:scale-95 transition cursor-pointer shadow-md"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 text-[#8A8A8E] hover:text-white transition cursor-pointer"
              aria-label="Dismiss install banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. First-visit iOS Safari Hint */}
      {!isDismissed && isIosSafari && (
        <div
          role="dialog"
          aria-label="Add Super Culture to iOS Home Screen"
          className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md p-3.5 rounded-2xl bg-[#121215]/95 border border-white/15 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
              <Share className="w-4 h-4 text-[#1ED760]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#F4F4F2]">Install on iPhone / iPad</p>
              <p className="text-[11px] text-[#8A8A8E]">Tap <span className="text-white font-medium">Share</span> &gt; <span className="text-white font-medium">Add to Home Screen</span></p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-[#8A8A8E] hover:text-white transition cursor-pointer shrink-0"
            aria-label="Dismiss iOS install hint"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
