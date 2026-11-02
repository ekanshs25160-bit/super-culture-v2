import { create } from 'zustand';
import { apiClient } from '../services/api';
import { LIBRARY_TRACKS } from '../data/tracks';

const MOODS_LIST = [
  { index: 0, name: 'Energetic' },
  { index: 1, name: 'Chill' },
  { index: 2, name: 'Melancholic' },
  { index: 3, name: 'Focused' },
];

export const useLibraryStore = create((set, get) => ({
  likedSongs: [LIBRARY_TRACKS.likedSongs],
  likedSongIds: new Set([
    LIBRARY_TRACKS.likedSongs.videoId,
    'MV_3Dpw-BRY', // Nightcall default liked
  ]),
  likedCount: 874,
  playlists: [
    {
      id: '35mm-night-archive',
      name: '35mm Night Archive',
      description: 'Sora Curated Archive',
      coverUrl: LIBRARY_TRACKS.tapeArchive.cover,
      createdAt: new Date().toISOString(),
    },
  ],
  mood: MOODS_LIST[0],
  mode: 'public',
  loading: false,
  error: null,

  /**
   * Check if a given video ID or track ID is liked in the active library
   */
  isLiked: (videoId) => {
    if (!videoId) return false;
    return (
      get().likedSongIds.has(videoId) ||
      get().likedSongs.some((s) => s.videoId === videoId || s.id === videoId)
    );
  },

  /**
   * Fetch initial library overview from backend
   */
  fetchLibraryOverview: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiClient.library.getOverview();
      const serverLikedIds = new Set((data.likedSongs || []).map((s) => s.videoId));
      
      // Preserve default seed tracks if server list is brand new
      if (serverLikedIds.size === 0) {
        serverLikedIds.add('MV_3Dpw-BRY');
      }

      let activeMood = get().mood;
      if (data.user?.mood) {
        const found = MOODS_LIST.find((m) => m.name.toLowerCase() === data.user.mood.toLowerCase());
        if (found) activeMood = found;
      }

      set({
        likedSongs: data.likedSongs?.length ? data.likedSongs : get().likedSongs,
        likedSongIds: serverLikedIds,
        likedCount: data.likedSongsCount || (data.likedSongs?.length ? data.likedSongs.length : 874),
        playlists: data.playlists?.length ? data.playlists : get().playlists,
        mood: activeMood,
        mode: data.user?.mode || 'public',
        loading: false,
      });
    } catch (err) {
      console.warn('[LibraryStore] Failed to fetch overview, using fallback seed:', err.message);
      set({ loading: false, error: err.message });
    }
  },

  /**
   * Toggle like with optimistic update & error rollback
   */
  toggleLike: async (track) => {
    if (!track) return;
    const videoId = track.videoId || track.id;
    if (!videoId) return;

    const prevLikedIds = new Set(get().likedSongIds);
    const prevLikedSongs = [...get().likedSongs];
    const prevCount = get().likedCount;

    const wasLiked = prevLikedIds.has(videoId);
    const nextLikedIds = new Set(prevLikedIds);
    let nextLikedSongs = [...prevLikedSongs];
    let nextCount;

    // Optimistic mutation
    if (wasLiked) {
      nextLikedIds.delete(videoId);
      nextLikedSongs = nextLikedSongs.filter((s) => (s.videoId || s.id) !== videoId);
      nextCount = Math.max(0, prevCount - 1);
    } else {
      nextLikedIds.add(videoId);
      nextLikedSongs.unshift({
        videoId,
        title: track.title,
        artist: track.artist,
        thumbnailUrl: track.cover || track.thumbnailUrl,
        duration: track.seconds || 210,
      });
      nextCount = prevCount + 1;
    }

    set({
      likedSongIds: nextLikedIds,
      likedSongs: nextLikedSongs,
      likedCount: nextCount,
    });

    try {
      const res = await apiClient.library.toggleLike(videoId, {
        videoId,
        title: track.title,
        artist: track.artist,
        thumbnailUrl: track.cover || track.thumbnailUrl,
        duration: track.seconds || 210,
      });

      // Synchronize with server count if returned
      if (typeof res.likedSongsCount === 'number') {
        set({ likedCount: res.likedSongsCount });
      }
    } catch (err) {
      console.error('[LibraryStore] toggleLike failed, rolling back:', err);
      // Rollback on failure
      set({
        likedSongIds: prevLikedIds,
        likedSongs: prevLikedSongs,
        likedCount: prevCount,
        error: 'Failed to update like status',
      });
    }
  },

  /**
   * Create custom playlist with optimistic update & rollback
   */
  createPlaylist: async (name, description = '') => {
    if (!name?.trim()) return null;

    const tempId = `temp-playlist-${Date.now()}`;
    const tempPlaylist = {
      id: tempId,
      name: name.trim(),
      description,
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
      createdAt: new Date().toISOString(),
    };

    const prevPlaylists = [...get().playlists];
    set({ playlists: [tempPlaylist, ...prevPlaylists] });

    try {
      const res = await apiClient.library.createPlaylist(name, description);
      const serverPlaylist = res.playlist || res;
      set({
        playlists: [serverPlaylist, ...prevPlaylists],
      });
      return serverPlaylist;
    } catch (err) {
      console.error('[LibraryStore] createPlaylist failed, rolling back:', err);
      set({ playlists: prevPlaylists, error: 'Failed to create playlist' });
      return null;
    }
  },

  /**
   * Update mood with optimistic update
   */
  setMood: async (index, name) => {
    const nextMood = { index, name };
    set({ mood: nextMood });

    try {
      await apiClient.vibe.updateMoodOrMode({ mood: name.toLowerCase() });
    } catch (err) {
      console.warn('[LibraryStore] updateMood failed on server:', err);
      // Keep optimistic mood in memory so UI never breaks
    }
  },

  /**
   * Update public/private session mode with optimistic update
   */
  setMode: async (mode) => {
    set({ mode });

    try {
      await apiClient.vibe.updateMoodOrMode({ mode });
    } catch (err) {
      console.warn('[LibraryStore] updateMode failed on server:', err);
      // Keep optimistic mode
    }
  },
}));
