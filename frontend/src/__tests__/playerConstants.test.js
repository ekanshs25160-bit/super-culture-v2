/* global global */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveEffectiveEngine,
  isMobileDevice,
  isMobileOrTouchDevice,
  isMobileViewport,
  PlaybackEngine,
  AUDIO_ENGINE_ENABLED,
  setAudioEngineEnabled,
} from '../engine/PlayerConstants.js';

function setNavigator(props) {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      maxTouchPoints: 0,
      standalone: false,
      ...props,
    },
    configurable: true,
    writable: true,
  });
}

describe('PlayerConstants & resolveEffectiveEngine Suite (A7)', () => {
  beforeEach(() => {
    // Reset browser globals to standard desktop environment before each test
    global.window = {
      innerWidth: 1280,
      matchMedia: () => ({ matches: false }),
    };
    setNavigator({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      maxTouchPoints: 0,
      standalone: false,
    });
  });

  afterEach(() => {
    setAudioEngineEnabled(false);
    delete globalThis.AUDIO_ENGINE_ENABLED;
  });

  describe('0. AUDIO_ENGINE_ENABLED Default Flag (false by default)', () => {
    it('defaults AUDIO_ENGINE_ENABLED to false so every device uses YouTube iframe when disabled', () => {
      assert.equal(AUDIO_ENGINE_ENABLED, false);

      // Desktop
      assert.equal(resolveEffectiveEngine('Auto'), 'youtube');

      // Mobile iPhone UA when AUDIO_ENGINE_ENABLED is false
      setNavigator({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      });
      global.window.innerWidth = 390;
      assert.equal(resolveEffectiveEngine('Auto'), 'youtube');
      assert.equal(resolveEffectiveEngine(PlaybackEngine.AUDIO), 'youtube');
    });
  });

  describe('1. Explicit Preference Enforcement (when AUDIO_ENGINE_ENABLED = true)', () => {
    beforeEach(() => {
      setAudioEngineEnabled(true);
    });

    it('always returns "audio" when preference is AUDIO stream regardless of device', () => {
      assert.equal(resolveEffectiveEngine(PlaybackEngine.AUDIO), 'audio');
      assert.equal(resolveEffectiveEngine('Audio stream'), 'audio');
      assert.equal(resolveEffectiveEngine('audio'), 'audio');
    });

    it('always returns "youtube" when preference is YOUTUBE player regardless of device', () => {
      global.window.innerWidth = 375;
      setNavigator({ userAgent: 'iPhone' });

      assert.equal(resolveEffectiveEngine(PlaybackEngine.YOUTUBE), 'youtube');
      assert.equal(resolveEffectiveEngine('YouTube player'), 'youtube');
      assert.equal(resolveEffectiveEngine('youtube'), 'youtube');
    });
  });

  describe('2. Auto Mode Mobile & Touch Detection Matrix (when AUDIO_ENGINE_ENABLED = true)', () => {
    beforeEach(() => {
      setAudioEngineEnabled(true);
    });

    it('detects mobile/tablet from Android / iPhone / iPad User-Agent regex', () => {
      setNavigator({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      });
      global.window.innerWidth = 1200;

      assert.equal(isMobileDevice(), true);
      assert.equal(isMobileOrTouchDevice(), true);
      assert.equal(resolveEffectiveEngine('Auto'), 'audio');
    });

    it('detects modern mobile via navigator.userAgentData.mobile Client Hints', () => {
      setNavigator({
        userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0',
        userAgentData: { mobile: true },
      });

      assert.equal(isMobileDevice(), true);
      assert.equal(resolveEffectiveEngine('Auto'), 'audio');
    });

    it('detects iPadOS on iOS 13+ (reports as Macintosh with multi-touch > 1)', () => {
      setNavigator({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15',
        maxTouchPoints: 5,
      });
      global.window.innerWidth = 1024;

      assert.equal(isMobileDevice(), true);
      assert.equal(resolveEffectiveEngine('Auto'), 'audio');
    });

    it('detects touch-primary device via matchMedia("(pointer: coarse)")', () => {
      global.window.matchMedia = (query) => ({
        matches: query === '(pointer: coarse)',
      });
      global.window.innerWidth = 1280;

      assert.equal(isMobileDevice(), true);
      assert.equal(resolveEffectiveEngine('Auto'), 'audio');
    });

    it('detects installed standalone PWA display mode', () => {
      global.window.matchMedia = (query) => ({
        matches: query === '(display-mode: standalone)',
      });

      assert.equal(isMobileDevice(), true);
      assert.equal(resolveEffectiveEngine('Auto'), 'audio');
    });

    it('390px desktop window stays on iframe (does NOT treat narrow desktop window as mobile)', () => {
      global.window.innerWidth = 390;
      global.window.matchMedia = () => ({ matches: false });
      setNavigator({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        userAgentData: { mobile: false },
        maxTouchPoints: 0,
        standalone: false,
      });

      assert.equal(isMobileViewport(), true, 'isMobileViewport reflects < 1024px CSS width');
      assert.equal(isMobileDevice(), false, '390px desktop window must NOT be classified as mobile device');
      assert.equal(resolveEffectiveEngine('Auto'), 'youtube', '390px desktop window stays on YouTube iframe');
    });

    it('defaults to YouTube IFrame on desktop viewport (>= 1024px) with mouse input', () => {
      global.window.innerWidth = 1440;
      setNavigator({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        maxTouchPoints: 0,
      });

      assert.equal(isMobileDevice(), false);
      assert.equal(resolveEffectiveEngine('Auto'), 'youtube');
    });
  });
});
