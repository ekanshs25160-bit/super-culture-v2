import axios from 'axios';

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

// Create dedicated axios instance with base URL /api
export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Send x-guest-id header on every request
api.interceptors.request.use(
  (config) => {
    config.headers['x-guest-id'] = getGuestId();
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Super Culture API Endpoint Handlers
 */
export const apiClient = {
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
    getHomeShelves: async () => {
      const res = await api.get('/music/home-shelves');
      return res.data;
    },
    search: async (query, limit = 40) => {
      const res = await api.get(`/music/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      return res.data;
    },
    getUpNext: async (videoId) => {
      const res = await api.get(`/music/up-next/${videoId}`);
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

  // Jam Synchronous Rooms API
  jam: {
    getActiveRooms: async () => {
      const res = await api.get('/jam/active/public');
      return res.data;
    },
    createRoom: async (name, isPrivate = false) => {
      const res = await api.post('/jam/create', { name, isPrivate });
      return res.data;
    },
    joinRoom: async (roomId, guestName = 'Super Culture Member') => {
      const res = await api.post('/jam/join', { roomId, guestName });
      return res.data;
    },
    addToQueue: async (roomId, song, playImmediately = false) => {
      const res = await api.post(`/jam/${roomId}/queue`, { song, playImmediately });
      return res.data;
    },
    sendHeartbeat: async (roomId) => {
      const res = await api.post(`/jam/${roomId}/heartbeat`);
      return res.data;
    },
  },
};

export default api;

