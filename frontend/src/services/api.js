import { useState, useEffect } from 'react';
import axios from 'axios';
import { Capacitor } from '@capacitor/core';

const GUEST_ID_KEY = 'super_culture_guest_id';

/**
 * Retrieves the persisted guest ID or generates a new RFC4122 UUID.
 */
export const getGuestId = () => {
  if (typeof window === 'undefined') return 'server-env';
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
};

export const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL ? import.meta.env.VITE_API_URL : '').replace(/\/$/, '');

// Dedicated axios instance for API calls
export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  withCredentials: true,
});

// Render cold-start detection: tracks if first request takes > 3s
let hasStartedFirstRequest = false;
let hasSettledFirstRequest = false;
let wakeTimer = null;
let isWakingUp = false;
const wakeListeners = new Set();

const notifyWakeState = (state) => {
  isWakingUp = state;
  wakeListeners.forEach((listener) => listener(state));
};

export const useServerWakeState = () => {
  const [waking, setWaking] = useState(isWakingUp);
  useEffect(() => {
    const handler = (state) => setWaking(state);
    wakeListeners.add(handler);
    return () => wakeListeners.delete(handler);
  }, []);
  return waking;
};

// Send x-guest-id header and arm 3s wake detector on initial data request
api.interceptors.request.use(
  (config) => {
    config.headers['x-guest-id'] = getGuestId();

    if (!hasStartedFirstRequest) {
      hasStartedFirstRequest = true;
      wakeTimer = setTimeout(() => {
        if (!hasSettledFirstRequest) {
          notifyWakeState(true);
        }
      }, 3000);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    if (!hasSettledFirstRequest) {
      hasSettledFirstRequest = true;
      if (wakeTimer) clearTimeout(wakeTimer);
      notifyWakeState(false);
    }
    return response;
  },
  (error) => {
    if (!hasSettledFirstRequest) {
      hasSettledFirstRequest = true;
      if (wakeTimer) clearTimeout(wakeTimer);
      notifyWakeState(false);
    }
    return Promise.reject(error);
  }
);

import {
  getNativeYtClient,
  resolveNativeStreamUrl,
} from './nativeStream.js';
export {
  getNativeYtClient,
  resolveNativeStreamUrl,
};

/**
 * Super Culture API Endpoint Handlers
 */
export const apiClient = {
  // Health & Readiness Probes
  health: {
    ping: async () => {
      try {
        const res = await axios.get(`${API_BASE}/health`, { timeout: 15000 });
        return res.data;
      } catch {
        return null;
      }
    },
    ready: async () => {
      const res = await axios.get(`${API_BASE}/ready`, { timeout: 15000 });
      return res.data;
    },
  },

  // Auth Passcode API
  auth: {
    submitPasscode: async (passcode) => {
      const res = await api.post('/auth/passcode', { passcode });
      return res.data;
    },
    checkStatus: async () => {
      const res = await api.get('/auth/status');
      return res.data;
    },
  },

  // Library API
  library: {
    getOverview: async () => {
      const res = await api.get('/library/overview');
      return res.data;
    },
    toggleLike: async (videoId, trackMeta) => {
      const res = await api.post(`/library/likes/${videoId}`, { trackMeta });
      return res.data;
    },
    createPlaylist: async (name, description = '') => {
      const res = await api.post('/library/playlists', { name, description });
      return res.data;
    },
    deletePlaylist: async (id) => {
      const res = await api.delete(`/library/playlists/${id}`);
      return res.data;
    },
    removeTrackFromPlaylist: async (id, videoId) => {
      const res = await api.delete(`/library/playlists/${id}/tracks/${videoId}`);
      return res.data;
    },
  },

  // Mood & Mode (Session) API
  vibe: {
    updateMoodOrMode: async ({ mood, mode }) => {
      const res = await api.post('/vibe/mood', { mood, mode });
      return res.data;
    },
  },

  // Music Streaming API
  music: {
    getStreamUrl: async (videoId, prefer = 'aac') => {
      // 1. Mobile Native Branch (Capacitor on iOS / Android)
      // Hits YouTube directly using the iOS client profile (bypasses browser CORS natively)
      if (Capacitor.isNativePlatform()) {
        try {
          return await resolveNativeStreamUrl(videoId, prefer);
        } catch (nativeErr) {
          console.warn('[apiClient] Native YouTube stream resolution failed, falling back to desktop proxy:', nativeErr);
        }
      }

      // 2. Desktop Web Branch (Local Node.js backend proxy)
      try {
        const res = await api.post('/music/stream-url', { videoId, prefer });
        return res.data;
      } catch {
        // Direct desktop proxy fallback: GET http://localhost:5001/api/yt/stream/:videoId
        const desktopHost = API_BASE || 'http://localhost:5001';
        return {
          url: `${desktopHost}/api/yt/stream/${videoId}`,
          videoId,
          expiresIn: 300,
        };
      }
    },
    getHomeShelves: async () => {
      const res = await api.get('/music/home-shelves');
      return res.data;
    },
    search: async (query, limit = 40) => {
      const res = await api.get(`/music/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      return res.data;
    },
    getArtist: async (name) => {
      const res = await api.get(`/music/artist/${encodeURIComponent(name)}`);
      return res.data;
    },
    getUpNext: async (videoId) => {
      const res = await api.get(`/music/up-next/${videoId}`);
      return res.data;
    },
    importTracklist: async (tracklist) => {
      const res = await api.post('/music/import', { tracklist });
      return res.data;
    },
  },

  // AI & DJ Engine API
  ai: {
    generateVibe: async (params) => {
      const res = await api.post('/ai/vibe', params);
      return res.data;
    },
    getAIDJ: async () => {
      const res = await api.post('/ai/dj');
      return res.data;
    },
    logHistory: async (song) => {
      const res = await api.post('/ai/log-history', { song });
      return res.data;
    },
  },
};

export default api;
