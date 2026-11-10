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

  it('synchronous unlock: blesses audio element with silent WAV data URI without emitting state changes', async () => {
    let recordedEvents = [];
    player.on('onPlaying', () => recordedEvents.push('playing'));
    player.on('onPaused', () => recordedEvents.push('paused'));
    player.on('onStateChange', (s) => recordedEvents.push(`state-${s}`));

    assert.equal(player.unlocked, false);
    assert.equal(player.getPlayerState(), PlayerState.UNSTARTED);

    // Call unlock synchronously
    player.unlock();

    assert.equal(player.unlocked, true);
    assert(player.audio.src.startsWith('data:audio/wav;base64,'));

    // Wait a tick for unlock's playPromise.then to resolve and pause
    await new Promise((r) => setTimeout(r, 10));

    // Must NOT leak any events or change state away from UNSTARTED
    assert.deepEqual(recordedEvents, [], 'Unlock phase must not emit playback events');
    assert.equal(player.getPlayerState(), PlayerState.UNSTARTED);

    // Calling unlock again should be an immediate no-op
    const previousSrc = player.audio.src;
    player.unlock();
    assert.equal(player.audio.src, previousSrc);
  });

  it('unlock does not pause real track if loadVideoById starts before unlock resolves', async () => {
    apiClient.music.getStreamUrl = async (videoId) => ({
      url: `/api/yt/stream/${videoId}?t=fast-track`,
    });

    // Synchronously unlock
    player.unlock();

    // Immediately load real track
    await player.loadVideoById({ videoId: 'fast-track' });

    assert.equal(player.audio.src, '/api/yt/stream/fast-track?t=fast-track');
    assert.equal(player.audio.paused, false);
    assert.equal(player.getPlayerState(), PlayerState.PLAYING);
  });

  it('preserves target seek timestamp (94.21s) across a failed stream refresh when audio.currentTime resets to 0', async () => {
    let callCount = 0;
    apiClient.music.getStreamUrl = async (videoId) => {
      callCount++;
      return { url: `/api/yt/stream/${videoId}?t=seek-token-${callCount}` };
    };

    await player.loadVideoById({ videoId: 'OfMBWq8Agf0' });
    assert.equal(callCount, 1);

    // User scrubs past the 1 MiB boundary to 94.21s
    player.seekTo(94.212765);
    assert.equal(player.getCurrentTime(), 94.212765);

    // Simulate browser behavior where assigning a failing 502 src resets audio.currentTime to 0
    // and play() rejects with a media error or AbortError
    player.audio.play = async () => {
      player.audio.currentTime = 0;
      const err = new Error('The play() request was interrupted by a failed media load (502)');
      err.name = 'AbortError';
      throw err;
    };

    let emittedError = null;
    player.on('onError', (code, err) => {
      emittedError = { code, err };
    });

    // First error at 94.21s triggers internal signed-URL refresh (handleStreamStall)
    player.audio.dispatchEvent({ type: 'error' });
    await new Promise((r) => setTimeout(r, 30));

    assert.equal(callCount, 2, 'Should refresh signed URL once');
    assert.equal(player.hasRetried, true, 'Player should mark hasRetried = true');
    assert.ok(emittedError !== null, 'Failed refresh play() must emit onError for fallback');
    assert.equal(player.audio.currentTime, 0, 'Underlying element reset to 0');
    assert.equal(player.getCurrentTime(), 94.212765, 'getCurrentTime() must preserve the 94.212765s seek target');
  });

  it('routes throttled streams directly to compatibility fallback at 0:00 without starting audio playback', async () => {
    apiClient.music.getStreamUrl = async (videoId) => ({
      url: `/api/yt/stream/${videoId}?t=throttled-token`,
      throttled: true,
    });

    let fallbackPayload = null;
    let throttledEventPayload = null;

    player = new AudioElementPlayer({
      onUnrecoverable: (payload) => {
        fallbackPayload = payload;
      },
    });

    player.on('onThrottled', (payload) => {
      throttledEventPayload = payload;
    });

    await player.loadVideoById({ videoId: 'throttled-test-vid', startSeconds: 0 });

    assert.equal(player.audio.src, '', 'Audio src must NOT be assigned for throttled tracks');
    assert.equal(player.audio.paused, true, 'Audio element must NOT start playing');
    assert.deepEqual(fallbackPayload, {
      videoId: 'throttled-test-vid',
      seconds: 0,
      reason: 'Stream throttled by YouTube • Compatibility mode (YouTube)',
    });
    assert.deepEqual(throttledEventPayload, fallbackPayload);
    assert.equal(player.hasRetried, true);
  });

  it('A5: restoring a saved state at 91s via cueVideoById makes zero network requests and emits no error; clicking play then loads at 91s', async () => {
    let networkRequests = 0;
    apiClient.music.getStreamUrl = async (videoId) => {
      networkRequests++;
      return { url: `/api/yt/stream/${videoId}?t=lazy-cue-token` };
    };

    let emittedError = null;
    let emittedStates = [];
    player.on('onError', (code, err) => {
      emittedError = { code, err };
    });
    player.on('onStateChange', (s) => {
      emittedStates.push(s);
    });

    // 1. Restore saved state at 91s
    await player.cueVideoById({ videoId: 'saved-track-91', startSeconds: 91 });

    assert.equal(networkRequests, 0, 'cueVideoById must make zero network requests');
    assert.equal(player.audio.src, '', 'cueVideoById must NOT set audio.src');
    assert.equal(player.audio.currentTime, 0, 'cueVideoById must NOT set audio.currentTime');
    assert.equal(player.userPaused, true, 'cueVideoById must set userPaused=true');
    assert.equal(player.currentVideoId, 'saved-track-91');
    assert.equal(player._lastKnownTime, 91);
    assert.equal(player.getCurrentTime(), 91);
    assert.equal(player.getPlayerState(), PlayerState.CUED);
    assert.deepEqual(emittedStates, [PlayerState.CUED]);
    assert.equal(emittedError, null, 'cueVideoById must emit no error');

    // 2. Clicking play (even after synchronous unlock) loads at 91s
    player.unlock();
    await player.playVideo();

    assert.equal(networkRequests, 1, 'First playVideo() fetches stream URL once');
    assert.equal(player.audio.src, '/api/yt/stream/saved-track-91?t=lazy-cue-token');
    assert.equal(player.audio.currentTime, 91, 'First playVideo() seeks to saved 91s position');
    assert.equal(player.getPlayerState(), PlayerState.PLAYING);
    assert.equal(emittedError, null);
  });

  it('A5: handleStreamStall does not call audio.play() when userPaused is true', async () => {
    apiClient.music.getStreamUrl = async (videoId) => ({
      url: `/api/yt/stream/${videoId}?t=stall-paused-token`,
    });

    await player.loadVideoById({ videoId: 'paused-stall-track', startSeconds: 30 });
    player.pauseVideo();
    assert.equal(player.userPaused, true);

    let playCalledDuringStall = false;
    const origPlay = player.audio.play.bind(player.audio);
    player.audio.play = async () => {
      playCalledDuringStall = true;
      return origPlay();
    };

    await player.handleStreamStall();
    assert.equal(playCalledDuringStall, false, 'handleStreamStall must not call audio.play() when userPaused is true');
  });
  it('preloaded next track: src is assigned and play() called synchronously with zero network requests', async () => {
    let requests = [];
    apiClient.music.getStreamUrl = async (videoId) => {
      requests.push(videoId);
      return { url: `/api/yt/stream/${videoId}?t=pre-${videoId}` };
    };

    await player.loadVideoById({ videoId: 'track-one' });
    await player.preloadNextStreamUrl('track-two');
    assert.deepEqual(requests, ['track-one', 'track-two']);
    assert.equal(player._preloadedNext.videoId, 'track-two');

    let playCalled = false;
    const origPlay = player.audio.play.bind(player.audio);
    player.audio.play = () => {
      playCalled = true;
      return origPlay();
    };

    // Simulates the 'ended' hand-off: no await between the call and the src/play() side effects
    const pending = player.loadVideoById({ videoId: 'track-two', startSeconds: 0 });
    assert.equal(player.audio.src, '/api/yt/stream/track-two?t=pre-track-two');
    assert.equal(playCalled, true, 'play() must be invoked synchronously');
    assert.deepEqual(player._preloadedNext, { videoId: null, url: null });

    await pending;
    assert.deepEqual(requests, ['track-one', 'track-two'], 'fast path must not fetch');
    assert.equal(player.getPlayerState(), PlayerState.PLAYING);
  });

  it('falls back to the network slow-path when the next track was not preloaded', async () => {
    let requests = [];
    apiClient.music.getStreamUrl = async (videoId) => {
      requests.push(videoId);
      return { url: `/api/yt/stream/${videoId}?t=slow-${videoId}` };
    };

    await player.preloadNextStreamUrl('wrong-track');
    await player.loadVideoById({ videoId: 'other-track' });

    assert.deepEqual(requests, ['wrong-track', 'other-track']);
    assert.equal(player.audio.src, '/api/yt/stream/other-track?t=slow-other-track');
  });

  it('does not use the fast path for a throttled preload (routes to compatibility fallback)', async () => {
    apiClient.music.getStreamUrl = async (videoId) => ({
      url: `/api/yt/stream/${videoId}?t=x`,
      throttled: true,
    });
    let fallback = null;
    player = new AudioElementPlayer({ onUnrecoverable: (p) => { fallback = p; } });

    await player.preloadNextStreamUrl('limited-track');
    await player.loadVideoById({ videoId: 'limited-track' });

    assert.equal(player.audio.src, '');
    assert.equal(fallback?.videoId, 'limited-track');
  });
});
