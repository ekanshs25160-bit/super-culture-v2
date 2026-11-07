import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlaybackEventHandler,
  getConsecutiveErrors,
  resetConsecutiveErrors,
} from '../engine/playbackEventHandler.js';
import { useUiStore } from '../store/useUiStore.js';

// Player whose single stream refresh has already been used up (hasRetried), as after a repeated 403 / 502.
const exhaustedPlayer = (currentTime = 0) => ({
  hasRetried: true,
  getCurrentTime: () => currentTime,
  handleStreamStall: async () => false,
  pauseVideo: () => {},
});

describe('Compatibility-mode fallback (audio -> YouTube IFrame)', () => {
  beforeEach(() => {
    resetConsecutiveErrors();
    useUiStore.setState({ temporaryEngineOverride: null, compatFallback: null });
  });

  it('hands the track to onUnrecoverable instead of skipping when the stream cannot be recovered', () => {
    let skipped = false;
    let fallbackArgs = null;

    const handler = createPlaybackEventHandler({
      getSkipNext: () => () => {
        skipped = true;
      },
      showToast: () => {},
      onUnrecoverable: (args) => {
        fallbackArgs = args;
        return true;
      },
    });

    handler.setTrack('vid-1');
    handler.handleError(100, 'stream 403', exhaustedPlayer());

    assert.equal(fallbackArgs.videoId, 'vid-1');
    assert.equal(skipped, false);
    assert.equal(getConsecutiveErrors(), 0, 'a handled fallback must not count toward the circuit breaker');
  });

  it('still skips the track when no fallback is available or it declines', async () => {
    let skipped = false;
    const handler = createPlaybackEventHandler({
      getSkipNext: () => () => {
        skipped = true;
      },
      showToast: () => {},
      onUnrecoverable: () => false,
    });

    handler.setTrack('vid-2');
    handler.handleError(100, 'stream 403', exhaustedPlayer());
    await new Promise((r) => setTimeout(r, 600));

    assert.equal(skipped, true);
    assert.equal(getConsecutiveErrors(), 1);
  });

  it('keeps the original retry-once behaviour before falling back', async () => {
    let retried = false;
    let fellBack = false;
    const player = {
      handleStreamStall: async () => {
        retried = true;
      },
      pauseVideo: () => {},
    };

    const handler = createPlaybackEventHandler({
      showToast: () => {},
      onUnrecoverable: () => {
        fellBack = true;
        return true;
      },
    });

    handler.setTrack('vid-3');
    handler.handleError(100, 'stream error', player);

    assert.equal(retried, true);
    assert.equal(fellBack, false);
  });

  it('store keeps the resume offset until the engine preference changes or the track moves on', () => {
    const s = useUiStore.getState();
    s.setCompatFallback({ videoId: 'vid-4', seconds: 64.5 });
    s.setTemporaryEngineOverride('youtube');
    assert.deepEqual(useUiStore.getState().compatFallback, { videoId: 'vid-4', seconds: 64.5 });

    useUiStore.getState().clearCompatFallback();
    assert.equal(useUiStore.getState().temporaryEngineOverride, null);
    assert.equal(useUiStore.getState().compatFallback, null);

    s.setCompatFallback({ videoId: 'vid-5', seconds: 10 });
    s.setTemporaryEngineOverride('youtube');
    useUiStore.getState().setPlaybackEngine('Auto');
    assert.equal(useUiStore.getState().compatFallback, null);
    assert.equal(useUiStore.getState().temporaryEngineOverride, null);
  });

  it('triggers onUnrecoverable immediately on first delegated error when AudioElementPlayer already retried at 94.21s', () => {
    let stallCalls = 0;
    let fallbackPayload = null;

    const playerAfterFailedRefresh = {
      hasRetried: true,
      getCurrentTime: () => 94.212765,
      handleStreamStall: async () => {
        stallCalls++;
        return false;
      },
      pauseVideo: () => {},
    };

    const handler = createPlaybackEventHandler({
      showToast: () => {},
      onUnrecoverable: ({ videoId, player }) => {
        const seconds = player.getCurrentTime();
        useUiStore.getState().setCompatFallback({ videoId, seconds });
        useUiStore.getState().setTemporaryEngineOverride('youtube');
        fallbackPayload = { videoId, seconds };
        return true;
      },
    });

    handler.setTrack('OfMBWq8Agf0');
    handler.handleError(100, '502 Bad Gateway after refresh', playerAfterFailedRefresh);

    assert.equal(stallCalls, 0, 'PlaybackEventHandler must not call handleStreamStall a second time');
    assert.deepEqual(fallbackPayload, { videoId: 'OfMBWq8Agf0', seconds: 94.212765 });
    assert.deepEqual(useUiStore.getState().compatFallback, {
      videoId: 'OfMBWq8Agf0',
      seconds: 94.212765,
    });
    assert.equal(useUiStore.getState().temporaryEngineOverride, 'youtube');
    assert.equal(getConsecutiveErrors(), 0);
  });
});
