/* global global */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// 1. Mock Browser Environment (document, window, localStorage, caches, URL)
const localStorageStore = new Map();
global.localStorage = {
  getItem: (key) => localStorageStore.get(key) || null,
  setItem: (key, val) => localStorageStore.set(key, String(val)),
  removeItem: (key) => localStorageStore.delete(key),
  clear: () => localStorageStore.clear(),
};

class MockAudioElement {
  constructor() {
    this.src = '';
    this.currentTime = 0;
    this.duration = 200;
    this.volume = 1.0;
    this.paused = true;
    this.playsInline = false;
    this.preload = 'none';
    this.style = {};
    this.listeners = new Map();
  }

  addEventListener(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }

  removeEventListener(event, fn) {
    if (this.listeners.has(event)) {
      this.listeners.set(event, this.listeners.get(event).filter((f) => f !== fn));
    }
  }

  dispatchEvent(event) {
    const list = this.listeners.get(event.type) || [];
    list.forEach((fn) => fn(event));
  }

  async play() {
    this.paused = false;
    this.dispatchEvent({ type: 'playing' });
  }

  pause() {
    this.paused = true;
    this.dispatchEvent({ type: 'pause' });
  }

  load() {}
}

const mockDocument = {
  createElement(tag) {
    if (tag === 'audio') return new MockAudioElement();
    return { style: {}, appendChild() {} };
  },
  body: {
    appendChild(el) {
      el.parentNode = mockDocument.body;
    },
    removeChild(el) {
      el.parentNode = null;
    },
  },
};

global.document = mockDocument;
global.window = {
  location: { href: 'http://localhost:3000' },
  addEventListener() {},
  removeEventListener() {},
};

// Mock Cache API
const cacheStorage = new Map();
class MockCache {
  constructor(name) {
    this.name = name;
    if (!cacheStorage.has(name)) {
      cacheStorage.set(name, new Map());
    }
    this.entries = cacheStorage.get(name);
  }

  async put(key, response) {
    this.entries.set(key, response);
  }

  async match(key) {
    return this.entries.get(key) || null;
  }

  async delete(key) {
    return this.entries.delete(key);
  }
}

global.caches = {
  open: async (name) => new MockCache(name),
  match: async (key) => {
    for (const cache of cacheStorage.values()) {
      if (cache.has(key)) return cache.get(key);
    }
    return null;
  },
};

if (globalThis.URL) {
  globalThis.URL.createObjectURL = (blob) => `blob:http://localhost:3000/${blob?.id || 'mock-blob-uuid'}`;
  globalThis.URL.revokeObjectURL = () => {};
}

try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { connection: { saveData: false }, userAgent: 'test' },
    writable: true,
    configurable: true,
  });
} catch (navErr) {
  void navErr;
}

// Import tested modules
const { AudioElementPlayer } = await import('../engine/AudioElementPlayer.js');
const { useLibraryStore } = await import('../store/useLibraryStore.js');
const { apiClient } = await import('../services/api.js');

describe('Offline Downloads & Playlist Import Suite', () => {
  beforeEach(() => {
    localStorageStore.clear();
    cacheStorage.clear();
  });

  describe('1. AudioElementPlayer Offline Playback', () => {
    it('plays from offline Cache API blob directly without calling getStreamUrl', async () => {
      const player = new AudioElementPlayer();
      const testVideoId = 'cached-test-vid-123';

      // Pre-populate offline audio cache
      const cache = await caches.open('sc-offline-audio');
      const mockBlob = { id: 'test-blob-123', size: 1024 * 1024, type: 'audio/mp4' };
      const mockResponse = {
        blob: async () => mockBlob,
      };
      await cache.put(`/offline-audio/${testVideoId}`, mockResponse);

      // Track if apiClient.music.getStreamUrl is called
      let apiCalled = false;
      const originalGetStreamUrl = apiClient.music.getStreamUrl;
      apiClient.music.getStreamUrl = async () => {
        apiCalled = true;
        return { url: '/api/yt/stream/should-not-be-called' };
      };

      try {
        await player.loadVideoById({ videoId: testVideoId });

        // Assert audio.src is the blob URL from the cache
        assert.equal(player.audio.src, 'blob:http://localhost:3000/test-blob-123');
        assert.equal(apiCalled, false, 'getStreamUrl should NOT be called when audio is cached');
      } finally {
        apiClient.music.getStreamUrl = originalGetStreamUrl;
        player.destroy();
      }
    });

    it('falls back to network getStreamUrl when audio is not in offline cache', async () => {
      const player = new AudioElementPlayer();
      const testVideoId = 'uncached-test-vid-456';

      let apiCalled = false;
      const originalGetStreamUrl = apiClient.music.getStreamUrl;
      apiClient.music.getStreamUrl = async (vid) => {
        apiCalled = true;
        return { url: `/api/yt/stream/${vid}?t=signedtoken` };
      };

      try {
        await player.loadVideoById({ videoId: testVideoId });

        assert.equal(apiCalled, true);
        assert.equal(player.audio.src, `/api/yt/stream/${testVideoId}?t=signedtoken`);
      } finally {
        apiClient.music.getStreamUrl = originalGetStreamUrl;
        player.destroy();
      }
    });
  });

  describe('2. useLibraryStore Multiple Track Playlist Creation', () => {
    it('creates a playlist with multiple normalized tracks and persists them', async () => {
      const mockTracks = [
        { videoId: 't1', title: 'Track 1', artist: 'Artist 1', duration: 180 },
        { videoId: 't2', title: 'Track 2', artist: 'Artist 2', duration: 210 },
      ];

      // Mock apiClient.library.createPlaylist
      const originalCreate = apiClient.library.createPlaylist;
      apiClient.library.createPlaylist = async (name, desc) => ({
        id: 'imported-pl-123',
        name,
        description: desc,
        tracks: [],
      });

      try {
        const created = await useLibraryStore
          .getState()
          .createPlaylistWithMultipleTracks('My Imported Mixtape', mockTracks);

        assert(created !== null);
        assert.equal(created.name, 'My Imported Mixtape');
        assert.equal(created.tracks.length, 2);
        assert.equal(created.tracks[0].videoId, 't1');
        assert.equal(created.tracks[1].videoId, 't2');

        // Check store state
        const stored = useLibraryStore.getState().playlists.find((p) => p.id === 'imported-pl-123');
        assert(stored !== null);
        assert.equal(stored.tracks.length, 2);

        // Check localStorage persistence
        const rawSaved = localStorage.getItem('superculture_playlist_tracks_imported-pl-123');
        assert(rawSaved !== null);
        const parsed = JSON.parse(rawSaved);
        assert.equal(parsed.length, 2);
      } finally {
        apiClient.library.createPlaylist = originalCreate;
      }
    });
  });

  describe('3. useLibraryStore Offline Download State Management', () => {
    it('manages download status, saves to Cache API and updates downloadedTracks', async () => {
      const testTrack = {
        videoId: 'dl-test-789',
        title: 'Offline Master',
        artist: 'Producer X',
        duration: 220,
      };

      // Mock apiClient.music.getStreamUrl
      const originalGetStreamUrl = apiClient.music.getStreamUrl;
      apiClient.music.getStreamUrl = async () => ({
        url: 'http://localhost:5001/api/yt/stream/dl-test-789?t=valid',
      });

      // Mock global fetch for audio stream
      const originalFetch = global.fetch;
      global.fetch = async (_url) => {
        void _url;
        return {
          ok: true,
          status: 200,
          headers: new Map([['Content-Type', 'audio/mp4']]),
          blob: async () => ({ size: 500000, type: 'audio/mp4' }),
          clone: () => ({}),
        };
      };

      try {
        assert.equal(useLibraryStore.getState().isDownloaded('dl-test-789'), false);

        // Download track
        const success = await useLibraryStore.getState().downloadTrack(testTrack);
        assert.equal(success, true);

        // Verify state
        assert.equal(useLibraryStore.getState().isDownloaded('dl-test-789'), true);
        const list = useLibraryStore.getState().downloadedTracks;
        assert(list.some((t) => t.videoId === 'dl-test-789'));

        // Verify cache entry
        const cache = await caches.open('sc-offline-audio');
        const cachedResponse = await cache.match('/offline-audio/dl-test-789');
        assert(cachedResponse !== null);

        // Remove track
        await useLibraryStore.getState().removeDownloadedTrack('dl-test-789');
        assert.equal(useLibraryStore.getState().isDownloaded('dl-test-789'), false);
        const cachedAfterDelete = await cache.match('/offline-audio/dl-test-789');
        assert.equal(cachedAfterDelete, null);
      } finally {
        apiClient.music.getStreamUrl = originalGetStreamUrl;
        global.fetch = originalFetch;
      }
    });
  });
});
