import { useState, useEffect } from 'react';

let globalDeferredPrompt = null;
const promptListeners = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    promptListeners.forEach((fn) => fn(globalDeferredPrompt));
  });
}

/**
 * Hook providing PWA installation state and trigger
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(globalDeferredPrompt);
  const [isStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  });
  const [isIosSafari] = useState(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isSafari = ua.includes('safari') && !ua.includes('crios') && !ua.includes('fxios');
    const standalone =
      window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    return isIos && isSafari && !standalone;
  });

  useEffect(() => {
    const handler = (prompt) => setDeferredPrompt(prompt);
    promptListeners.add(handler);
    return () => promptListeners.delete(handler);
  }, []);

  const promptInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
      }
    }
  };

  return {
    canInstall: Boolean(deferredPrompt),
    isIosSafari,
    isStandalone,
    promptInstall,
  };
}
