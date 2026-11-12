import { create } from 'zustand';

let toastTimer = null;
const ENGINE_STORAGE_KEY = 'super_culture_playback_engine';

export const useUiStore = create((set) => ({
  toastMessage: null,
  isNotificationsOpen: false,
  isSettingsOpen: false,
  isAiDjLive: false,
  addToPlaylistTrack: null,
  isMobileMenuOpen: false,
  isCsvImportOpen: false,

  // Mobile / Background Engine Preferences: 'Auto' | 'Audio stream' | 'YouTube player'
  playbackEngine: (typeof localStorage !== 'undefined' && localStorage.getItem(ENGINE_STORAGE_KEY)) || 'Auto',
  temporaryEngineOverride: null,
  // Set when the audio stream fails mid-track and playback is handed to the YouTube IFrame:
  // { videoId, seconds } so the iframe can resume at the same offset.
  compatFallback: null,
  activeEngine: 'audio',
  lastFallbackReason: null,
  isAutoplayBlocked: false,

  setActiveEngine: (engine) => set({ activeEngine: engine }),
  setLastFallbackReason: (reason) => set({ lastFallbackReason: reason }),

  setPlaybackEngine: (engine) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ENGINE_STORAGE_KEY, engine);
    }
    set({ playbackEngine: engine, temporaryEngineOverride: null, compatFallback: null });
  },

  setTemporaryEngineOverride: (override) => set({ temporaryEngineOverride: override }),
  setCompatFallback: (fallback) => set({ compatFallback: fallback }),
  clearCompatFallback: () => set({ temporaryEngineOverride: null, compatFallback: null }),
  setAutoplayBlocked: (blocked) => set({ isAutoplayBlocked: blocked }),

  showToast: (message, duration = 3000) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: message });
    toastTimer = setTimeout(() => {
      set({ toastMessage: null });
      toastTimer = null;
    }, duration);
  },

  openAddToPlaylist: (track) => set({ addToPlaylistTrack: track }),
  closeAddToPlaylist: () => set({ addToPlaylistTrack: null }),

  openCsvImport: () => set({ isCsvImportOpen: true }),
  closeCsvImport: () => set({ isCsvImportOpen: false }),

  setNotificationsOpen: (open) => set({ isNotificationsOpen: open }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  toggleNotifications: () => set((state) => ({ isNotificationsOpen: !state.isNotificationsOpen, isSettingsOpen: false })),
  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen, isNotificationsOpen: false })),
  closePopovers: () => set({ isNotificationsOpen: false, isSettingsOpen: false }),

  setAiDjLive: (isLive) => set({ isAiDjLive: isLive }),
  toggleAiDj: () => set((state) => ({ isAiDjLive: !state.isAiDjLive })),

  toggleMobileMenu: () => set((s) => ({ isMobileMenuOpen: !s.isMobileMenuOpen })),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
}));
