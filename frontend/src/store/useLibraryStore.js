import { create } from 'zustand';
import { apiClient, API_BASE } from '../services/api.js';
import {
  MOODS_LIST,
  normalizeTrack,
  loadSavedTracks,
  persistTracks,
  loadFollowedArtists,
  saveFollowedArtists,
  loadDownloadedTracks,
  saveDownloadedTracks,
} from './libraryHelpers.js';

export const useLibraryStore = create((set, get) => ({
  likedSongs: [],
  likedSongIds: new Set(),
  likedCount: 0,
  playlists: [],
  followedArtists: loadFollowedArtists(),
  downloadedTracks: loadDownloadedTracks(),
  downloadingIds: new Set(),
  mood: MOODS_LIST[0],
  mode: 'public',
  loading: false,
  error: null,

  isLiked: (videoId) => {
    if (!videoId) return false;
    return (
      get().likedSongIds.has(videoId) ||
      get().likedSongs.some((s) => s.videoId === videoId || s.id === videoId)
    );
  },

  isDownloaded: (videoId) => {
    if (!videoId) return false;
    return get().downloadedTracks.some((t) => (t.videoId || t.id) === videoId);
  },

  isDownloading: (videoId) => {
    if (!videoId) return false;
    return get().downloadingIds.has(videoId);
  },

  fetchLibraryOverview: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiClient.library.getOverview();
      const serverLikedIds = new Set((data.likedSongs || []).map((s) => s.videoId || s.id));

      let activeMood = get().mood;
      if (data.user?.mood) {
        const found = MOODS_LIST.find((m) => m.name.toLowerCase() === data.user.mood.toLowerCase());
        if (found) activeMood = found;
      }

      const serverPlaylists = Array.isArray(data.playlists) ? data.playlists : [];
      const mergedPlaylists = serverPlaylists.map((p) => {
        const localTracks = loadSavedTracks(p.id);
        return {
          ...p,
          tracks: Array.isArray(p.tracks) && p.tracks.length > 0 ? p.tracks : localTracks,
        };
      });

      const currentList = get().playlists;
      for (const cur of currentList) {
        if (!mergedPlaylists.some((p) => p.id === cur.id)) {
          mergedPlaylists.push(cur);
        }
      }

      set({
        likedSongs: Array.isArray(data.likedSongs) ? data.likedSongs : [],
        likedSongIds: serverLikedIds,
        likedCount: data.likedSongs?.length ?? 0,
        playlists: mergedPlaylists,
        mood: activeMood,
        mode: data.user?.mode || 'public',
        loading: false,
      });
    } catch (err) {
      console.warn('[LibraryStore] Failed to fetch overview:', err.message);
      set({ loading: false, error: err.message });
    }
  },

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

    if (wasLiked) {
      nextLikedIds.delete(videoId);
      nextLikedSongs = nextLikedSongs.filter((s) => (s.videoId || s.id) !== videoId);
      nextCount = Math.max(0, prevCount - 1);
    } else {
      nextLikedIds.add(videoId);
      nextLikedSongs.unshift({
        videoId,
        id: videoId,
        title: track.title,
        artist: track.artist,
        thumbnailUrl: track.cover || track.thumbnailUrl || track.thumbnail_url,
        cover: track.cover || track.thumbnailUrl || track.thumbnail_url,
        duration: track.seconds || 210,
        seconds: track.seconds || 210,
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
        thumbnailUrl: track.cover || track.thumbnailUrl || track.thumbnail_url,
        duration: track.seconds || 210,
      });

      if (typeof res?.likedSongsCount === 'number') {
        set({ likedCount: res.likedSongsCount });
      }
    } catch (err) {
      console.error('[LibraryStore] toggleLike failed, rolling back:', err);
      set({
        likedSongIds: prevLikedIds,
        likedSongs: prevLikedSongs,
        likedCount: prevCount,
        error: 'Failed to update like status',
      });
    }
  },

  createPlaylist: async (name, description = '') => {
    if (!name?.trim()) return null;

    const tempId = `temp-playlist-${Date.now()}`;
    const tempPlaylist = {
      id: tempId,
      name: name.trim(),
      description,
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
      tracks: [],
      createdAt: new Date().toISOString(),
    };

    const prevPlaylists = [...get().playlists];
    set({ playlists: [tempPlaylist, ...prevPlaylists] });

    try {
      const res = await apiClient.library.createPlaylist(name, description);
      const serverPlaylist = res.playlist || res;
      const normalized = {
        ...serverPlaylist,
        tracks: Array.isArray(serverPlaylist.tracks) ? serverPlaylist.tracks : [],
      };
      set({
        playlists: [normalized, ...prevPlaylists],
      });
      return normalized;
    } catch (err) {
      console.error('[LibraryStore] createPlaylist failed, rolling back:', err);
      set({ playlists: prevPlaylists, error: 'Failed to create playlist' });
      return null;
    }
  },

  addTrackToPlaylist: (playlistId, track) => {
    if (!playlistId || !track) return { added: false, reason: 'invalid_args' };
    const normalized = normalizeTrack(track);
    if (!normalized?.videoId) return { added: false, reason: 'invalid_track' };

    const playlists = get().playlists;
    const target = playlists.find((p) => p.id === playlistId);
    if (!target) return { added: false, reason: 'not_found' };

    const existingTracks = Array.isArray(target.tracks) ? target.tracks : [];
    const isDuplicate = existingTracks.some(
      (t) => (t.videoId && t.videoId === normalized.videoId) || t.id === normalized.id
    );

    const playlistName = target.name || target.title || 'Playlist';
    if (isDuplicate) {
      return { added: false, reason: 'duplicate', playlistName };
    }

    const nextTracks = [...existingTracks, normalized];
    const nextPlaylists = playlists.map((p) =>
      p.id === playlistId ? { ...p, tracks: nextTracks } : p
    );

    persistTracks(playlistId, nextTracks);
    set({ playlists: nextPlaylists });
    return { added: true, playlistName };
  },

  removeTrackFromPlaylist: (playlistId, videoId) => {
    if (!playlistId || !videoId) return { removed: false };
    const playlists = get().playlists;
    const target = playlists.find((p) => p.id === playlistId);
    if (!target) return { removed: false };

    const existingTracks = Array.isArray(target.tracks) ? target.tracks : [];
    const nextTracks = existingTracks.filter(
      (t) => (t.videoId || t.id) !== videoId
    );

    const playlistName = target.name || target.title || 'Playlist';
    const nextPlaylists = playlists.map((p) =>
      p.id === playlistId ? { ...p, tracks: nextTracks } : p
    );

    persistTracks(playlistId, nextTracks);
    set({ playlists: nextPlaylists });
    return { removed: true, playlistName };
  },

  updatePlaylistName: (playlistId, newName) =>
    set((state) => ({
      playlists: state.playlists.map((p) =>
        p.id === playlistId ? { ...p, name: newName } : p
      ),
    })),

  createPlaylistWithTrack: async (name, track) => {
    const created = await get().createPlaylist(name);
    if (created && track) {
      get().addTrackToPlaylist(created.id, track);
      return {
        ...created,
        tracks: [normalizeTrack(track)],
      };
    }
    return created;
  },

  createPlaylistWithMultipleTracks: async (name, tracks = []) => {
    if (!name?.trim()) return null;
    const created = await get().createPlaylist(name.trim());
    if (!created) return null;

    if (Array.isArray(tracks) && tracks.length > 0) {
      const normalizedList = tracks.map(normalizeTrack).filter(Boolean);
      const playlists = get().playlists;
      const nextPlaylists = playlists.map((p) =>
        p.id === created.id ? { ...p, tracks: normalizedList } : p
      );
      persistTracks(created.id, normalizedList);
      set({ playlists: nextPlaylists });
      return {
        ...created,
        tracks: normalizedList,
      };
    }
    return created;
  },

  downloadTrack: async (track) => {
    if (!track) return false;
    const videoId = track.videoId || track.id;
    if (!videoId) return false;
    if (get().isDownloaded(videoId)) return true;

    const currentDownloading = new Set(get().downloadingIds);
    currentDownloading.add(videoId);
    set({ downloadingIds: currentDownloading });

    try {
      // 1. Fetch signed stream URL from backend
      const { url } = await apiClient.music.getStreamUrl(videoId, 'aac');
      const fullAudioUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

      // 2. Fetch binary audio stream data
      const audioRes = await fetch(fullAudioUrl);
      if (!audioRes.ok) {
        throw new Error(`Stream fetch failed with status ${audioRes.status}`);
      }
      const audioBlob = await audioRes.blob();

      // 3. Put into Cache API under 'sc-offline-audio'
      if (typeof caches !== 'undefined') {
        const cache = await caches.open('sc-offline-audio');
        const headers = new Headers();
        headers.set('Content-Type', audioRes.headers.get('Content-Type') || 'audio/mp4');
        headers.set('Content-Length', String(audioBlob.size));
        const cacheResponse = new Response(audioBlob, { headers });
        await cache.put(`/offline-audio/${videoId}`, cacheResponse);

        // Pre-cache thumbnail/cover art if available
        const coverUrl = track.cover || track.thumbnailUrl || track.albumArt;
        if (coverUrl && coverUrl.startsWith('http')) {
          try {
            const imgRes = await fetch(coverUrl, { mode: 'cors' });
            if (imgRes.ok) {
              await cache.put(`/offline-art/${videoId}`, imgRes);
            }
          } catch (imgErr) {
            console.debug('[LibraryStore] Cover art caching skipped:', imgErr);
          }
        }
      }

      // 4. Persist track metadata in store and localStorage
      const normalized = normalizeTrack(track);
      const nextDownloaded = [
        normalized,
        ...get().downloadedTracks.filter((t) => (t.videoId || t.id) !== videoId),
      ];
      saveDownloadedTracks(nextDownloaded);

      const nextDownloading = new Set(get().downloadingIds);
      nextDownloading.delete(videoId);
      set({
        downloadedTracks: nextDownloaded,
        downloadingIds: nextDownloading,
      });
      return true;
    } catch (err) {
      console.error('[LibraryStore] downloadTrack failed:', err);
      const nextDownloading = new Set(get().downloadingIds);
      nextDownloading.delete(videoId);
      set({
        downloadingIds: nextDownloading,
        error: `Failed to download "${track.title || 'track'}"`,
      });
      return false;
    }
  },

  removeDownloadedTrack: async (videoId) => {
    if (!videoId) return;

    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open('sc-offline-audio');
        await cache.delete(`/offline-audio/${videoId}`);
        await cache.delete(`/offline-art/${videoId}`);
      } catch (err) {
        console.warn('[LibraryStore] Cache deletion error:', err);
      }
    }

    const nextDownloaded = get().downloadedTracks.filter((t) => (t.videoId || t.id) !== videoId);
    saveDownloadedTracks(nextDownloaded);
    set({ downloadedTracks: nextDownloaded });
  },

  isFollowingArtist: (artistName) => {
    if (!artistName) return false;
    const clean = artistName.trim().toLowerCase();
    return get().followedArtists.some((a) => a.name.toLowerCase() === clean);
  },

  toggleFollowArtist: (artist) => {
    if (!artist) return false;
    const artistName = typeof artist === 'string' ? artist.trim() : (artist.name || '').trim();
    if (!artistName) return false;

    const prev = get().followedArtists;
    const clean = artistName.toLowerCase();
    const isFollowing = prev.some((a) => a.name.toLowerCase() === clean);

    let next;
    if (isFollowing) {
      next = prev.filter((a) => a.name.toLowerCase() !== clean);
    } else {
      const entry = typeof artist === 'object' ? {
        id: `artist-${Date.now()}`,
        name: artistName,
        avatar: artist.avatar || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
        genre: artist.genre || 'Electronic',
        followedAt: new Date().toISOString(),
      } : {
        id: `artist-${Date.now()}`,
        name: artistName,
        avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
        genre: 'Electronic',
        followedAt: new Date().toISOString(),
      };
      next = [entry, ...prev];
    }

    saveFollowedArtists(next);
    set({ followedArtists: next });
    return !isFollowing;
  },

  setMood: async (index, name) => {
    const nextMood = { index, name };
    set({ mood: nextMood });
    try {
      await apiClient.vibe.updateMoodOrMode({ mood: name.toLowerCase() });
    } catch (err) {
      console.warn('[LibraryStore] updateMood failed on server:', err);
    }
  },

  setMode: async (mode) => {
    set({ mode });
    try {
      await apiClient.vibe.updateMoodOrMode({ mode });
    } catch (err) {
      console.warn('[LibraryStore] updateMode failed on server:', err);
    }
  },
}));
