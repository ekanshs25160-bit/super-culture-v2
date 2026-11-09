import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlaybackEventHandler,
  getConsecutiveErrors,
  resetConsecutiveErrors,
} from '../engine/playbackEventHandler.js';
import { useUiStore } from '../store/useUiStore.js';
import {
  bindAudioPlayerLoadTracking,
  prepareTrackSelection,
  syncAudioEngineTrack,
} from '../engine/trackTransitionSync.js';
import { AudioElementPlayer } from '../engine/AudioElementPlayer.js';
import { PlayerState } from '../engine/PlayerConstants.js';
import { apiClient } from '../services/api.js';

// Ensure minimal DOM globals exist if compatFallback.test.js runs standalone
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement() {
      return {
        src: '',
        currentTime: 0,
        duration: 200,
        volume: 1,
        paused: true,
        style: {},
        addEventListener(type, fn) {
          this._listeners = this._listeners || {};
          (this._listeners[type] = this._listeners[type] || []).push(fn);
        },
        removeEventListener() {},
        dispatchEvent(ev) {
          (this._listeners?.[ev.type] || []).forEach((f) => f(ev));
        },
        async play() {
          this.paused = false;
          this.dispatchEvent({ type: 'playing' });
        },
        pause() {
          this.paused = true;
          this.dispatchEvent({ type: 'pause' });
        },
        load() {},
      };
    },
    body: { appendChild() {}, removeChild() {} },
  };
}

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

  it('routes directly to YouTube compatibility mode at 0s when stream is flagged as throttled', () => {
    const handleFallback = ({ videoId, seconds, reason }) => {
      useUiStore.getState().setCompatFallback({ videoId, seconds });
      useUiStore.getState().setTemporaryEngineOverride('youtube');
      useUiStore.getState().setLastFallbackReason(reason);
      return true;
    };

    const payload = {
      videoId: 'throttled-track-abc',
      seconds: 0,
      reason: 'Stream throttled by YouTube • Compatibility mode (YouTube)',
    };

    handleFallback(payload);

    assert.deepEqual(useUiStore.getState().compatFallback, {
      videoId: 'throttled-track-abc',
      seconds: 0,
    });
    assert.equal(useUiStore.getState().temporaryEngineOverride, 'youtube');
    assert.equal(
      useUiStore.getState().lastFallbackReason,
      'Stream throttled by YouTube • Compatibility mode (YouTube)'
    );
  });

  it('A3: track 1 enters compat fallback, user selects track 2: clears fallback, sets audio.src to track 2, and starts playback', async () => {
    apiClient.music.getStreamUrl = async (videoId) => ({
      url: `/api/yt/stream/${videoId}?t=token-for-${videoId}`,
      throttled: false,
    });

    const lastLoadedVideoId = { current: null };
    const playerRef = { current: null };
    const audioPlayer = new AudioElementPlayer();
    bindAudioPlayerLoadTracking(audioPlayer, lastLoadedVideoId);
    playerRef.current = audioPlayer;

    // 1. Track 1 starts on audio, then enters compatFallback (switching active playerRef to YouTubePlayer)
    const track1 = { videoId: 'track-1-throttled', title: 'Track 1', artist: 'Artist 1' };
    await audioPlayer.loadVideoById({ videoId: track1.videoId, startSeconds: 0 });
    assert.equal(lastLoadedVideoId.current, 'track-1-throttled');

    // Simulate compatFallback activating YouTube iframe engine
    let ytLoadCalledWith = null;
    const fakeYtPlayer = {
      loadVideoById: async (args) => {
        ytLoadCalledWith = args;
      },
      pauseVideo: () => {},
    };
    useUiStore.getState().setCompatFallback({ videoId: track1.videoId, seconds: 64.5 });
    useUiStore.getState().setTemporaryEngineOverride('youtube');
    playerRef.current = fakeYtPlayer;

    // AudioEngineHost syncs when effectiveEngine === 'youtube'
    syncAudioEngineTrack({
      effectiveEngine: 'youtube',
      currentTrack: track1,
      isPlaying: true,
      currentTime: 64.5,
      audioPlayer,
      lastLoadedVideoIdRef: lastLoadedVideoId,
      setPlayerRef: (p) => {
        playerRef.current = p;
      },
    });
    assert.equal(lastLoadedVideoId.current, null);

    // 2. User selects Track 2 while compatFallback is active
    const track2 = { videoId: 'track-2-clean', title: 'Track 2', artist: 'Artist 2' };
    const prep = prepareTrackSelection({
      track: track2,
      currentTrackVideoId: track1.videoId,
      playerRef,
      uiStore: useUiStore,
    });

    assert.equal(prep.hadCompatFallback, true);
    assert.equal(prep.shouldLoadOnPlayerRef, false, 'Must not call loadVideoById on stale YouTube playerRef');
    assert.equal(ytLoadCalledWith, null, 'Stale YouTubePlayer must not receive Track 2');
    assert.equal(useUiStore.getState().compatFallback, null);
    assert.equal(useUiStore.getState().temporaryEngineOverride, null);

    // 3. AudioEngineHost re-renders with effectiveEngine = 'audio' and currentTrack = track2, isPlaying = true
    const synced = syncAudioEngineTrack({
      effectiveEngine: 'audio',
      currentTrack: track2,
      isPlaying: true,
      currentTime: 0,
      audioPlayer,
      lastLoadedVideoIdRef: lastLoadedVideoId,
      setPlayerRef: (p) => {
        playerRef.current = p;
      },
    });

    assert.equal(synced, true);
    await audioPlayer.loadPromise;

    assert.equal(playerRef.current, audioPlayer);
    assert.equal(lastLoadedVideoId.current, 'track-2-clean');
    assert.equal(audioPlayer.audio.src, '/api/yt/stream/track-2-clean?t=token-for-track-2-clean');
    assert.equal(audioPlayer.audio.paused, false);
    assert.equal(audioPlayer.getPlayerState(), PlayerState.PLAYING);
  });

  it('A3: selecting the same track twice does not double-load', async () => {
    let streamUrlFetchCount = 0;
    apiClient.music.getStreamUrl = async (videoId) => {
      streamUrlFetchCount++;
      return {
        url: `/api/yt/stream/${videoId}?t=token-${streamUrlFetchCount}`,
        throttled: false,
      };
    };

    const lastLoadedVideoId = { current: null };
    const playerRef = { current: null };
    const audioPlayer = new AudioElementPlayer();
    bindAudioPlayerLoadTracking(audioPlayer, lastLoadedVideoId);
    playerRef.current = audioPlayer;

    const track = { videoId: 'same-track-id', title: 'Same Track', artist: 'Artist' };

    // First selection: playSelectedTrack + AudioEngineHost render
    const prep1 = prepareTrackSelection({
      track,
      currentTrackVideoId: null,
      playerRef,
      uiStore: useUiStore,
    });
    assert.equal(prep1.shouldLoadOnPlayerRef, true);
    await playerRef.current.loadVideoById({ videoId: track.videoId, startSeconds: 0 });

    // AudioEngineHost useEffect runs after state commit
    const synced1 = syncAudioEngineTrack({
      effectiveEngine: 'audio',
      currentTrack: track,
      isPlaying: true,
      currentTime: 0,
      audioPlayer,
      lastLoadedVideoIdRef: lastLoadedVideoId,
      setPlayerRef: (p) => {
        playerRef.current = p;
      },
    });
    assert.equal(synced1, false, 'AudioEngineHost must not double-load a track already loaded by playSelectedTrack');
    assert.equal(streamUrlFetchCount, 1);

    // Second selection of the exact same track: must NOT loadVideoById again
    const prep2 = prepareTrackSelection({
      track,
      currentTrackVideoId: track.videoId,
      playerRef,
      uiStore: useUiStore,
    });
    assert.equal(prep2.isSameTrack, true);
    assert.equal(prep2.shouldLoadOnPlayerRef, false);

    const synced2 = syncAudioEngineTrack({
      effectiveEngine: 'audio',
      currentTrack: track,
      isPlaying: true,
      currentTime: 12,
      audioPlayer,
      lastLoadedVideoIdRef: lastLoadedVideoId,
      setPlayerRef: (p) => {
        playerRef.current = p;
      },
    });
    assert.equal(synced2, false);
    assert.equal(streamUrlFetchCount, 1, 'Selecting the same track twice must not double-load');
  });
});
