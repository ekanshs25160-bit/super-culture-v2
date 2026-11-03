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
});
