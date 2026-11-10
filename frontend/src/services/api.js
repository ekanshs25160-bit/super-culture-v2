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
import nativeYtClient from './nativeYtClient.js';

export {
  getNativeYtClient,
  resolveNativeStreamUrl,
  nativeYtClient,
};

/**
 * Super Culture API Endpoint Handlers
 */
export const apiClient = {
  // Health & Readiness Probes
  health: {
    ping: async () => {
      if (Capacitor.isNativePlatform()) return { status: 'ok', native: true };
      try {
        const res = await axios.get(`${API_BASE}/health`, { timeout: 15000 });
        return res.data;
      } catch {
        return null;
      }
    },
    ready: async () => {
      if (Capacitor.isNativePlatform()) return { ready: true, native: true };
      const res = await axios.get(`${API_BASE}/ready`, { timeout: 15000 });
      return res.data;
    },
  },

  // Auth Passcode API
  auth: {
    submitPasscode: async (passcode) => {
      if (Capacitor.isNativePlatform()) return { success: true };
      const res = await api.post('/auth/passcode', { passcode });
      return res.data;
    },
    checkStatus: async () => {
      if (Capacitor.isNativePlatform()) return { authenticated: true, bypass: true };
      const res = await api.get('/auth/status');
      return res.data;
    },
  },

  // Library API (Persisted to localStorage on Native Mobile when offline)
  library: {
    getOverview: async () => {
      if (Capacitor.isNativePlatform()) {
        const liked = JSON.parse(localStorage.getItem('super_culture_local_liked_songs') || '[]');
        const playlists = JSON.parse(localStorage.getItem('super_culture_local_playlists') || '[]');
        return {
          likedSongs: liked,
          playlists,
          user: { mood: 'Euphoric', mode: 'public' },
        };
      }
      const res = await api.get('/library/overview');
      return res.data;
    },
    toggleLike: async (videoId, trackMeta) => {
      if (Capacitor.isNativePlatform()) {
        const liked = JSON.parse(localStorage.getItem('super_culture_local_liked_songs') || '[]');
        const idx = liked.findIndex((s) => (s.videoId || s.id) === videoId);
        let isNowLiked = false;
        if (idx >= 0) {
          liked.splice(idx, 1);
        } else {
          isNowLiked = true;
          liked.unshift({
            videoId,
            id: videoId,
            ...(trackMeta?.trackMeta || trackMeta || {}),
          });
        }
        localStorage.setItem('super_culture_local_liked_songs', JSON.stringify(liked));
        return { liked: isNowLiked, likedSongsCount: liked.length };
      }
      const res = await api.post(`/library/likes/${videoId}`, { trackMeta });
      return res.data;
    },
    createPlaylist: async (name, description = '') => {
      if (Capacitor.isNativePlatform()) {
        const playlists = JSON.parse(localStorage.getItem('super_culture_local_playlists') || '[]');
        const newPl = {
          id: `local-pl-${Date.now()}`,
          name: name.trim(),
          description,
          coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
          tracks: [],
          createdAt: new Date().toISOString(),
        };
        playlists.unshift(newPl);
        localStorage.setItem('super_culture_local_playlists', JSON.stringify(playlists));
        return { playlist: newPl };
      }
      const res = await api.post('/library/playlists', { name, description });
      return res.data;
    },
    deletePlaylist: async (id) => {
      if (Capacitor.isNativePlatform()) {
        let playlists = JSON.parse(localStorage.getItem('super_culture_local_playlists') || '[]');
        playlists = playlists.filter((p) => p.id !== id);
        localStorage.setItem('super_culture_local_playlists', JSON.stringify(playlists));
        return { success: true };
      }
      const res = await api.delete(`/library/playlists/${id}`);
      return res.data;
    },
    removeTrackFromPlaylist: async (id, videoId) => {
      if (Capacitor.isNativePlatform()) {
        const playlists = JSON.parse(localStorage.getItem('super_culture_local_playlists') || '[]');
        const target = playlists.find((p) => p.id === id);
        if (target && Array.isArray(target.tracks)) {
          target.tracks = target.tracks.filter((t) => (t.videoId || t.id) !== videoId);
          localStorage.setItem('super_culture_local_playlists', JSON.stringify(playlists));
        }
        return { success: true };
      }
      const res = await api.delete(`/library/playlists/${id}/tracks/${videoId}`);
      return res.data;
    },
  },

  // Mood & Mode (Session) API
  vibe: {
    updateMoodOrMode: async ({ mood, mode }) => {
      if (Capacitor.isNativePlatform()) {
        localStorage.setItem('super_culture_local_vibe', JSON.stringify({ mood, mode }));
        return { success: true, mood, mode };
      }
      const res = await api.post('/vibe/mood', { mood, mode });
      return res.data;
    },
  },

  // Music Streaming API
  music: {
    getStreamUrl: async (videoId, prefer = 'aac') => {
      // 1. Mobile Native Branch (Capacitor on iOS / Android)
      // Hits YouTube directly using VISIONOS / on-device client profile
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
      if (Capacitor.isNativePlatform()) {
        return await nativeYtClient.getHomeShelves();
      }
      const res = await api.get('/music/home-shelves');
      return res.data;
    },
    search: async (query, limit = 40) => {
      if (Capacitor.isNativePlatform()) {
        return await nativeYtClient.search(query, limit);
      }
      const res = await api.get(`/music/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      return res.data;
    },
    getArtist: async (name) => {
      if (Capacitor.isNativePlatform()) {
        return await nativeYtClient.getArtist(name);
      }
      const res = await api.get(`/music/artist/${encodeURIComponent(name)}`);
      return res.data;
    },
    getUpNext: async (videoId) => {
      if (Capacitor.isNativePlatform()) {
        return await nativeYtClient.getUpNext(videoId);
      }
      const res = await api.get(`/music/up-next/${videoId}`);
      return res.data;
    },
    importTracklist: async (tracklist) => {
      if (Capacitor.isNativePlatform()) {
        return await nativeYtClient.importTracklist(tracklist);
      }
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
      if (Capacitor.isNativePlatform()) {
        try {
          const history = JSON.parse(localStorage.getItem('super_culture_ai_history') || '[]');
          history.unshift({ song, timestamp: Date.now() });
          localStorage.setItem('super_culture_ai_history', JSON.stringify(history.slice(0, 50)));
        } catch {
          // Ignore local storage write errors
        }
        return { success: true };
      }
      const res = await api.post('/ai/log-history', { song });
      return res.data;
    },
  },
};

export default api;
