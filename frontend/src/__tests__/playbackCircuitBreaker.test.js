import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlaybackEventHandler,
  getConsecutiveErrors,
  getCurrentTrackPlayStart,
  setCurrentTrackPlayStartForTesting,
  resetConsecutiveErrors,
} from '../engine/playbackEventHandler.js';

describe('PlaybackEventHandler Circuit Breaker Suite', () => {
  beforeEach(() => {
    resetConsecutiveErrors();
  });

  it('1. retries stream once when consecutiveErrors < 3', async () => {
    let retried = false;
    let skipped = false;

    const mockPlayer = {
      handleStreamStall: async () => {
        retried = true;
      },
      pauseVideo: () => {},
    };

    const handler = createPlaybackEventHandler({
      getSkipNext: () => () => {
        skipped = true;
      },
      setIsPlaying: () => {},
      showToast: () => {},
    });

    handler.setTrack('test-track-1');
    handler.handleAudioError(new Error('Stream failed'), mockPlayer);

    assert.equal(getConsecutiveErrors(), 1);
    assert.equal(retried, true);
    assert.equal(skipped, false);
  });

  it('2. when retry fails or track errors again, calls skipNext(1) after 500ms delay', async () => {
    let skipCount = 0;
    let skipArg = null;

    const mockPlayer = {
      handleStreamStall: async () => {
        throw new Error('Retry failed');
      },
      pauseVideo: () => {},
    };

    const handler = createPlaybackEventHandler({
      getSkipNext: () => (arg) => {
        skipCount++;
        skipArg = arg;
      },
      setIsPlaying: () => {},
      showToast: () => {},
    });

    handler.setTrack('failing-track');
    handler.handleAudioError(new Error('Initial error'), mockPlayer);

    // Wait for the retry promise rejection to process
    await new Promise((r) => setTimeout(r, 20));

    // Immediately before 500ms, skipNext should NOT have run yet
    assert.equal(skipCount, 0, 'Should not skip immediately');

    // Wait past 500ms timeout
    await new Promise((r) => setTimeout(r, 550));

    assert.equal(skipCount, 1, 'Should call skipNext(1) after 500ms');
    assert.equal(skipArg, 1);
  });

  it('3. trips circuit breaker at 3 consecutive errors: pauses, shows toast, sets isPlaying(false), and does NOT skip', async () => {
    let paused = false;
    let isPlayingVal = true;
    let toastMessage = null;
    let skipCalled = false;

    const mockPlayer = {
      handleStreamStall: async () => {},
      pauseVideo: () => {
        paused = true;
      },
    };

    const handler = createPlaybackEventHandler({
      getSkipNext: () => () => {
        skipCalled = true;
      },
      setIsPlaying: (val) => {
        isPlayingVal = val;
      },
      showToast: (msg) => {
        toastMessage = msg;
      },
      pauseVideo: () => {
        paused = true;
      },
    });

    // Simulate 2 previous failures on previous tracks
    handler.setTrack('track-1');
    handler.handleAudioError(new Error('err 1'), mockPlayer);
    assert.equal(getConsecutiveErrors(), 1);

    handler.setTrack('track-2');
    handler.handleAudioError(new Error('err 2'), mockPlayer);
    assert.equal(getConsecutiveErrors(), 2);

    // 3rd failure triggers circuit breaker
    handler.setTrack('track-3');
    handler.handleAudioError(new Error('err 3'), mockPlayer);
    assert.equal(getConsecutiveErrors(), 3);

    // Assert circuit breaker actions
    assert.equal(paused, true, 'pauseVideo() must be called');
    assert.equal(isPlayingVal, false, 'isPlaying must be set to false');
    assert.equal(toastMessage, 'Streaming unavailable right now. Try again later.');

    // Wait past 600ms to ensure no delayed skip was triggered
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(skipCalled, false, 'skipNext must NOT be called when circuit breaker trips');
  });

  it('4. resets consecutiveErrors ONLY when currentTrackPlayStart !== null and (Date.now() - currentTrackPlayStart) >= 3000', () => {
    const handler = createPlaybackEventHandler({
      getSkipNext: () => () => {},
      setIsPlaying: () => {},
      showToast: () => {},
    });

    handler.setTrack('track-1');
    handler.handleAudioError(new Error('err 1'));
    handler.handleAudioError(new Error('err 2'));
    assert.equal(getConsecutiveErrors(), 2);
    assert.equal(getCurrentTrackPlayStart(), null);

    // Spurious timeupdate when not playing (e.g. mid-song mobile switch) must NOT reset consecutiveErrors
    handler.onTimeUpdate(45.0);
    assert.equal(getConsecutiveErrors(), 2);

    // Changing tracks must clear currentTrackPlayStart and NOT reset consecutiveErrors
    handler.onPlaying();
    assert(getCurrentTrackPlayStart() !== null);
    handler.setTrack('track-2');
    assert.equal(getCurrentTrackPlayStart(), null);
    assert.equal(getConsecutiveErrors(), 2);

    // onPaused clears currentTrackPlayStart
    handler.onPlaying();
    assert(getCurrentTrackPlayStart() !== null);
    handler.onPaused();
    assert.equal(getCurrentTrackPlayStart(), null);

    // Starting playback sets currentTrackPlayStart, but < 3000ms elapsed does NOT reset
    handler.onPlaying();
    handler.onTimeUpdate(50.0);
    assert.equal(getConsecutiveErrors(), 2);

    // After >= 3000ms of continuous playback, onTimeUpdate resets consecutiveErrors to 0
    setCurrentTrackPlayStartForTesting(Date.now() - 3100);
    handler.onTimeUpdate(53.0);
    assert.equal(getConsecutiveErrors(), 0);
  });
});
