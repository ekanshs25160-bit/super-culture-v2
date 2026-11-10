import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Capacitor } from '@capacitor/core';
import { apiClient } from '../services/api.js';
import nativeYtClient, {
  setNativeProxyPortForTesting,
  setMockPlayerResponseForTesting,
  setMockWatchPageForTesting,
  VISIONOS_USER_AGENT,
} from '../services/nativeYtClient.js';

// In-memory localStorage mock for node test runner
const memoryStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => memoryStorage.get(key) || null,
  setItem: (key, val) => memoryStorage.set(key, String(val)),
  removeItem: (key) => memoryStorage.delete(key),
  clear: () => memoryStorage.clear(),
};

describe('Standalone Native Mobile Suite (Backend Turned OFF)', () => {
  beforeEach(() => {
    localStorage.clear();
    setNativeProxyPortForTesting(null);
    setMockPlayerResponseForTesting(null);
    setMockWatchPageForTesting(null);
  });

  afterEach(() => {
    localStorage.clear();
    setNativeProxyPortForTesting(null);
    setMockPlayerResponseForTesting(null);
    setMockWatchPageForTesting(null);
  });

  it('1. nativeYtClient extracts visitorData and sts from watch page context', async () => {
    setMockWatchPageForTesting(() => ({
      visitorData: 'test-visitor-token-12345',
      sts: 20760,
    }));

    const ctx = await nativeYtClient.getWatchPageVisitorData('test-vid-1');
    assert.equal(ctx.visitorData, 'test-visitor-token-12345');
    assert.equal(ctx.sts, 20760);
  });

  it('2. resolveNativeStreamUrl constructs local Android loopback proxy URL with VISIONOS User-Agent', async () => {
    const origIsNative = Capacitor.isNativePlatform;
    const origPlatform = Capacitor.getPlatform;
    Capacitor.isNativePlatform = () => true;
    Capacitor.getPlatform = () => 'android';
    setNativeProxyPortForTesting(8888);

    setMockWatchPageForTesting({ visitorData: 'mock-vd', sts: 20760 });

    // Mock global fetch for player request and 1.5 MiB probe
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('/youtubei/v1/player')) {
        const body = JSON.parse(options.body || '{}');
        assert.equal(body.context?.client?.clientName, 'VISIONOS');
        assert.equal(body.videoId, 'test-vid-2');
        const payload = {
          playabilityStatus: { status: 'OK' },
          streamingData: {
            adaptiveFormats: [
              {
                itag: 251,
                mimeType: 'audio/webm; codecs="opus"',
                bitrate: 160000,
                url: 'https://googlevideo.com/videoplayback?id=test-vid-2-opus',
              },
              {
                itag: 140,
                mimeType: 'audio/mp4; codecs="mp4a.40.2"',
                bitrate: 128000,
                url: 'https://googlevideo.com/videoplayback?id=test-vid-2-m4a',
              },
            ],
          },
        };
        return {
          status: 200,
          json: async () => payload,
          text: async () => JSON.stringify(payload),
          headers: new Headers({ 'content-type': 'application/json' }),
        };
      }

      if (urlStr.includes('googlevideo.com')) {
        assert.equal(options.headers?.Range, 'bytes=1572864-1572900');
        return {
          status: 206,
          json: async () => ({}),
          text: async () => '',
          headers: new Headers({ 'content-range': 'bytes 1572864-1572900/5000000' }),
        };
      }

      return { status: 404, text: async () => '' };
    };

    try {
      const res = await nativeYtClient.resolveNativeStreamUrl('test-vid-2', 'aac');
      assert.ok(res.url.startsWith('http://127.0.0.1:8888/stream?url='), 'Should route through local loopback proxy');
      assert.ok(res.url.includes(encodeURIComponent('https://googlevideo.com/videoplayback?id=test-vid-2-m4a')));
      assert.ok(res.url.includes(encodeURIComponent(VISIONOS_USER_AGENT)));
      assert.equal(res.directUrl, 'https://googlevideo.com/videoplayback?id=test-vid-2-m4a');
      assert.equal(res.throttled, false);
      assert.equal(res.isNative, true);
    } finally {
      Capacitor.isNativePlatform = origIsNative;
      Capacitor.getPlatform = origPlatform;
      globalThis.fetch = origFetch;
    }
  });

  it('3. Standalone catalog: getHomeShelves returns curated shelves with valid tracks', async () => {
    const shelvesRes = await nativeYtClient.getHomeShelves();
    assert.ok(Array.isArray(shelvesRes.shelves));
    assert.ok(shelvesRes.shelves.length >= 4);

    const trending = shelvesRes.shelves.find((s) => s.id === 'trending_worldwide');
    assert.ok(trending);
    assert.ok(trending.items.length > 0);
    assert.ok(trending.items[0].videoId);
    assert.ok(trending.items[0].title);
    assert.ok(trending.items[0].artist);
  });

  it('4. Offline Mobile Library: stores liked songs and playlists in localStorage without backend', async () => {
    const origIsNative = Capacitor.isNativePlatform;
    Capacitor.isNativePlatform = () => true;

    try {
      // Initially empty overview
      let overview = await apiClient.library.getOverview();
      assert.deepEqual(overview.likedSongs, []);
      assert.deepEqual(overview.playlists, []);

      // Toggle Like Track 1
      const likeRes1 = await apiClient.library.toggleLike('track-101', {
        title: 'Song 101',
        artist: 'Artist 101',
      });
      assert.equal(likeRes1.liked, true);
      assert.equal(likeRes1.likedSongsCount, 1);

      overview = await apiClient.library.getOverview();
      assert.equal(overview.likedSongs.length, 1);
      assert.equal(overview.likedSongs[0].videoId, 'track-101');
      assert.equal(overview.likedSongs[0].title, 'Song 101');

      // Create Playlist
      const plRes = await apiClient.library.createPlaylist('Late Night Jams', 'Favorites');
      assert.ok(plRes.playlist.id);
      assert.equal(plRes.playlist.name, 'Late Night Jams');

      overview = await apiClient.library.getOverview();
      assert.equal(overview.playlists.length, 1);
      assert.equal(overview.playlists[0].name, 'Late Night Jams');

      // Toggle Like again to unlike
      const likeRes2 = await apiClient.library.toggleLike('track-101');
      assert.equal(likeRes2.liked, false);
      assert.equal(likeRes2.likedSongsCount, 0);

      // Delete Playlist
      await apiClient.library.deletePlaylist(plRes.playlist.id);
      overview = await apiClient.library.getOverview();
      assert.equal(overview.playlists.length, 0);
    } finally {
      Capacitor.isNativePlatform = origIsNative;
    }
  });

  it('5. Offline Mobile AI Log & Health probes succeed without backend', async () => {
    const origIsNative = Capacitor.isNativePlatform;
    Capacitor.isNativePlatform = () => true;

    try {
      const pingRes = await apiClient.health.ping();
      assert.equal(pingRes.native, true);

      const authRes = await apiClient.auth.checkStatus();
      assert.equal(authRes.bypass, true);

      const logRes = await apiClient.ai.logHistory({ videoId: 'log-1', title: 'Test' });
      assert.equal(logRes.success, true);
    } finally {
      Capacitor.isNativePlatform = origIsNative;
    }
  });
});
