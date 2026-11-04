/* global global */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock browser globals for HTMLAudioElement & DOM
class MockAudioElement {
  constructor(id = '') {
    this.id = id;
    this.src = '';
    this.currentTime = 0;
    this.duration = 240;
    this.volume = 1.0;
    this.paused = true;
    this.playsInline = false;
    this.preload = 'none';
    this.style = {};
    this.listeners = new Map();
  }

  addEventListener(event, fn) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(fn);
  }

  removeEventListener(event, fn) {
    if (this.listeners.has(event)) {
      const list = this.listeners.get(event).filter((f) => f !== fn);
      this.listeners.set(event, list);
    }
  }

  dispatchEvent(event) {
    const list = this.listeners.get(event.type) || [];
    list.forEach((fn) => fn(event));
  }

  async play() {
    this.paused = false;
    this.dispatchEvent({ type: 'playing' });
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.dispatchEvent({ type: 'pause' });
  }

  load() {}
}

const mockDocument = {
  elements: [],
  createElement(tag) {
    if (tag === 'audio') {
      const el = new MockAudioElement();
      return el;
    }
    return { style: {}, appendChild() {} };
  },
  body: {
    appendChild(el) {
      el.parentNode = mockDocument.body;
      mockDocument.elements.push(el);
    },
    removeChild(el) {
      el.parentNode = null;
      mockDocument.elements = mockDocument.elements.filter((e) => e !== el);
    },
  },
};

global.document = mockDocument;
global.window = {
  location: { href: 'http://localhost:3000' },
  addEventListener() {},
  removeEventListener() {},
};

try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { connection: { saveData: false }, userAgent: 'test' },
    writable: true,
    configurable: true,
  });
} catch {
  // if navigator already has connection, ignore
}

// Import AudioElementPlayer and PlayerConstants
const { AudioElementPlayer } = await import('../engine/AudioElementPlayer.js');
const { PlayerState } = await import('../engine/PlayerConstants.js');
const { apiClient } = await import('../services/api.js');

describe('AudioElementPlayer Unit Tests', () => {
  let player;

  beforeEach(() => {
    mockDocument.elements = [];
    player = new AudioElementPlayer();
  });

  it('initializes persistent hidden audio elements with playsInline and preload', () => {
    assert(player.audio !== null);
    assert.equal(player.audio.playsInline, true);
    assert.equal(player.audio.preload, 'auto');
    assert.equal(player.audio.style.display, 'none');
    assert(player.preloadAudio !== null);
    assert.equal(player.preloadAudio.preload, 'none');
  });

  it('correctly maps audio element events to YouTube-compatible PlayerState numbers', () => {
    // Initial state
    assert.equal(player.getPlayerState(), PlayerState.UNSTARTED);

    let recordedState = null;
    player.on('onStateChange', (state) => {
      recordedState = state;
    });

    // 1. playing -> PLAYING (1)
    player.audio.dispatchEvent({ type: 'playing' });
    assert.equal(player.getPlayerState(), PlayerState.PLAYING);
    assert.equal(recordedState, PlayerState.PLAYING);

    // 2. waiting -> BUFFERING (3)
    player.audio.dispatchEvent({ type: 'waiting' });
    assert.equal(player.getPlayerState(), PlayerState.BUFFERING);
    assert.equal(recordedState, PlayerState.BUFFERING);

    // 3. pause -> PAUSED (2)
    player.audio.dispatchEvent({ type: 'pause' });
    assert.equal(player.getPlayerState(), PlayerState.PAUSED);
    assert.equal(recordedState, PlayerState.PAUSED);

    // 4. ended -> ENDED (0)
    player.audio.dispatchEvent({ type: 'ended' });
    assert.equal(player.getPlayerState(), PlayerState.ENDED);
    assert.equal(recordedState, PlayerState.ENDED);
  });

  it('fetches signed stream URL and loads audio on loadVideoById', async () => {
    let requestedVideoId = null;
    apiClient.music.getStreamUrl = async (videoId) => {
      requestedVideoId = videoId;
      return { url: `/api/yt/stream/${videoId}?t=signed-token-123` };
    };

    await player.loadVideoById({ videoId: 'video-test-456' });

    assert.equal(requestedVideoId, 'video-test-456');
    assert.equal(player.audio.src, '/api/yt/stream/video-test-456?t=signed-token-123');
    assert.equal(player.getPlayerState(), PlayerState.PLAYING);
  });

  it('refreshes signed URL and resumes playback from current time on stream stall or network error', async () => {
    let callCount = 0;
    apiClient.music.getStreamUrl = async (videoId) => {
      callCount++;
      return { url: `/api/yt/stream/${videoId}?t=token-attempt-${callCount}` };
    };

    await player.loadVideoById({ videoId: 'retry-track' });
    assert.equal(callCount, 1);

    // Simulate playback progressed to 45 seconds
    player.audio.currentTime = 45;

    // Simulate an audio error (e.g. signed URL expired)
    let errorFired = false;
    player.on('onError', () => {
      errorFired = true;
    });

    // Trigger error event
    player.audio.dispatchEvent({ type: 'error' });

    // Allow promise resolution
    await new Promise((r) => setTimeout(r, 50));

    // First error must trigger a silent refresh and resume from 45s without firing onError
    assert.equal(callCount, 2);
    assert.equal(player.audio.src, '/api/yt/stream/retry-track?t=token-attempt-2');
    assert.equal(player.audio.currentTime, 45);
    assert.equal(errorFired, false);

    // If a second error occurs consecutively, it should notify via onError for fallback
    player.audio.dispatchEvent({ type: 'error' });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(errorFired, true);
  });

  it('provides player controls: seekTo, setVolume, getVolume, getCurrentTime, destroy', () => {
    player.audio.currentTime = 10;
    player.audio.duration = 180;

    assert.equal(player.getCurrentTime(), 10);
    assert.equal(player.getDuration(), 180);

    player.seekTo(72);
    assert.equal(player.audio.currentTime, 72);

    player.setVolume(50);
    assert.equal(player.getVolume(), 50);
    assert.equal(player.audio.volume, 0.5);

    player.destroy();
    assert.equal(mockDocument.elements.length, 0);
  });

  it('stale request guard: discards older skipped track when rapid skipping occurs', async () => {
    let track1Resolve;
    const track1Promise = new Promise((resolve) => {
      track1Resolve = resolve;
    });

    apiClient.music.getStreamUrl = async (videoId) => {
      if (videoId === 'slow-track-1') {
        await track1Promise;
        return { url: '/api/yt/stream/slow-track-1?t=1' };
      }
      return { url: `/api/yt/stream/${videoId}?t=fast` };
    };

    // 1. Kick off slow track 1
    const p1 = player.loadVideoById({ videoId: 'slow-track-1' });

    // 2. Immediately kick off track 2 before track 1 resolves
    const p2 = player.loadVideoById({ videoId: 'fast-track-2' });

    await p2;
    assert.equal(player.audio.src, '/api/yt/stream/fast-track-2?t=fast');

    // 3. Now let track 1 finish resolving
    track1Resolve();
    await p1;

    // 4. Assert track 1 did NOT overwrite track 2
    assert.equal(player.audio.src, '/api/yt/stream/fast-track-2?t=fast');
    assert.equal(player.currentSrc, '/api/yt/stream/fast-track-2?t=fast');
  });

  it('race condition: calling playVideo synchronously right after loadVideoById awaits loadPromise safely', async () => {
    let loadFinished = false;
    apiClient.music.getStreamUrl = async (videoId) => {
      await new Promise((r) => setTimeout(r, 20));
      loadFinished = true;
      return { url: `/api/yt/stream/${videoId}?t=sync-test` };
    };

    // Start load without awaiting
    const loadPromise = player.loadVideoById({ videoId: 'sync-race-track' });
    assert(player.loadPromise !== null);

    // Call playVideo immediately (synchronous race condition simulation)
    const playPromise = player.playVideo();

    await Promise.all([loadPromise, playPromise]);
    assert.equal(loadFinished, true);
    assert.equal(player.audio.src, '/api/yt/stream/sync-race-track?t=sync-test');
    assert.equal(player.getPlayerState(), PlayerState.PLAYING);
  });

  it('reportError emits onError at most once per load attempt', () => {
    let errorCount = 0;
    player.on('onError', () => {
      errorCount++;
    });

    player.currentVideoId = 'error-track-1';
    player.reportError(100, new Error('First failure'), 'error-track-1');
    player.reportError(100, new Error('Second failure'), 'error-track-1');
    player.reportError(100, new Error('Third failure'), 'error-track-1');

    assert.equal(errorCount, 1, 'onError should only fire once per attempt');

    // Resetting for a new load attempt allows 1 more report
    player.loadToken++;
    player.errorReportedFor = null;
    player.reportError(100, new Error('New attempt failure'), 'error-track-1');
    assert.equal(errorCount, 2, 'onError should fire once for the new attempt');
  });

  it('safely resumes audio on playVideo after pauseVideo', async () => {
    apiClient.music.getStreamUrl = async (videoId) => ({
      url: `/api/yt/stream/${videoId}?t=resume-test`,
    });

    await player.loadVideoById({ videoId: 'resume-track' });
    assert.equal(player.getPlayerState(), PlayerState.PLAYING);

    player.pauseVideo();
    assert.equal(player.getPlayerState(), PlayerState.PAUSED);

    await player.playVideo();
    assert.equal(player.getPlayerState(), PlayerState.PLAYING);
  });
});
