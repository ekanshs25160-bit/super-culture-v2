import { create } from 'zustand';

let toastTimer = null;

export const useUiStore = create((set) => ({
  toastMessage: null,
  isNotificationsOpen: false,
  isSettingsOpen: false,
  isAiDjLive: false,
  addToPlaylistTrack: null,

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

  setNotificationsOpen: (open) => set({ isNotificationsOpen: open }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  toggleNotifications: () => set((state) => ({ isNotificationsOpen: !state.isNotificationsOpen, isSettingsOpen: false })),
  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen, isNotificationsOpen: false })),
  closePopovers: () => set({ isNotificationsOpen: false, isSettingsOpen: false }),

  setAiDjLive: (isLive) => set({ isAiDjLive: isLive }),
  toggleAiDj: () => set((state) => ({ isAiDjLive: !state.isAiDjLive })),
}));
