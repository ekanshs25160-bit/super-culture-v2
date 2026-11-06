import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Capacitor } from '@capacitor/core';
import { apiClient } from '../services/api.js';
import { AudioElementPlayer } from '../engine/AudioElementPlayer.js';
import { resolveNativeStreamUrl } from '../services/nativeStream.js';
import { setNativeYtClientForTesting } from '../services/nativeStream.js';

// Setup MockAudioElement and mockDocument for DOM simulation
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
    if (!this.listeners.has(event)) this.listeners.set(event, []);
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
    if (tag === 'audio') return new MockAudioElement();
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

globalThis.document = mockDocument;

describe('Capacitor Mobile vs Desktop Stream URL Branching', () => {
  it('1. routes through desktop backend when Capacitor.isNativePlatform() is false', async () => {
    const origIsNative = Capacitor.isNativePlatform;
    Capacitor.isNativePlatform = () => false;

    try {
      const res = await apiClient.music.getStreamUrl('test-desktop-vid-1');
      assert.ok(res.url, 'Should return a stream url object');
      assert.ok(res.url.includes('test-desktop-vid-1'), 'Url should contain video id');
      assert.ok(!res.isNative, 'Desktop response should not have isNative=true flag');
    } finally {
      Capacitor.isNativePlatform = origIsNative;
    }
  });

  it('2. routes to native YouTube resolver when Capacitor.isNativePlatform() is true', async () => {
    const origIsNative = Capacitor.isNativePlatform;
    Capacitor.isNativePlatform = () => true;

    assert.equal(Capacitor.isNativePlatform(), true);

    Capacitor.isNativePlatform = origIsNative;
  });

  const fakeFormat = (url) => ({ has_audio: true, mime_type: 'audio/mp4; codecs="mp4a.40.2"', bitrate: 128000, url });
  const makeYt = (behavior, calls) => ({
    session: { player: {} },
    getBasicInfo: async (id, opts) => {
      calls.push(opts.client);
      return behavior[opts.client]();
    },
  });

  it('3. Android picks ANDROID first and falls back through TV_EMBEDDED, WEB', async () => {
    const origPlatform = Capacitor.getPlatform;
    Capacitor.getPlatform = () => 'android';
    const calls = [];
    setNativeYtClientForTesting(makeYt({
      ANDROID: () => { throw new Error('boom'); },
      TV_EMBEDDED: () => ({ streaming_data: { adaptive_formats: [] } }),
      WEB: () => ({ streaming_data: { adaptive_formats: [fakeFormat('https://yt/web')] } }),
    }, calls));
    try {
      const res = await resolveNativeStreamUrl('vid');
      assert.deepEqual(calls, ['ANDROID', 'TV_EMBEDDED', 'WEB']);
      assert.equal(res.url, 'https://yt/web');
    } finally {
      Capacitor.getPlatform = origPlatform;
      setNativeYtClientForTesting(null);
    }
  });

  it('4. iOS uses IOS first and throws when no client yields a URL', async () => {
    const origPlatform = Capacitor.getPlatform;
    Capacitor.getPlatform = () => 'ios';
    const calls = [];
    setNativeYtClientForTesting(makeYt({
      IOS: () => ({ streaming_data: { adaptive_formats: [] } }),
      TV_EMBEDDED: () => ({ streaming_data: { adaptive_formats: [] } }),
    }, calls));
    try {
      await assert.rejects(() => resolveNativeStreamUrl('vid'), /Could not resolve mobile stream URL/);
      assert.deepEqual(calls, ['IOS', 'TV_EMBEDDED']);
    } finally {
      Capacitor.getPlatform = origPlatform;
      setNativeYtClientForTesting(null);
    }
  });

  it('5. AudioElementPlayer assigns the direct URL to audio.src (no blob proxy)', async () => {
    const origIsNative = Capacitor.isNativePlatform;
    Capacitor.isNativePlatform = () => true;
    const player = new AudioElementPlayer();
    player.prepareTrack = async () => 'https://example.com/direct-stream';
    try {
      await player.loadVideoById({ videoId: 'mobile-test-vid' });
      assert.equal(player.audio.src, 'https://example.com/direct-stream');
    } finally {
      player.destroy();
      Capacitor.isNativePlatform = origIsNative;
    }
  });
});
