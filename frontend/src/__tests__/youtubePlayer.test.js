import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildYtPlayerOptions,
  hasValidVideoId,
  initOrSyncYouTubePlayer,
} from '../engine/youtubePlayerController.js';

describe('A4: YouTubePlayer null track handling', () => {
  it('omits videoId from YT.Player options when videoId is null/undefined/empty', () => {
    const optsNull = buildYtPlayerOptions({
      videoId: null,
      origin: 'http://localhost:3000',
      events: {},
    });
    assert.equal('videoId' in optsNull, false, 'videoId key must be omitted when null');

    const optsUndefined = buildYtPlayerOptions({
      videoId: undefined,
      origin: 'http://localhost:3000',
      events: {},
    });
    assert.equal('videoId' in optsUndefined, false, 'videoId key must be omitted when undefined');

    const optsValid = buildYtPlayerOptions({
      videoId: 'dQw4w9WgXcQ',
      origin: 'http://localhost:3000',
      events: {},
    });
    assert.equal(optsValid.videoId, 'dQw4w9WgXcQ');
    assert.equal(hasValidVideoId(null), false);
    assert.equal(hasValidVideoId(undefined), false);
    assert.equal(hasValidVideoId(''), false);
    assert.equal(hasValidVideoId('dQw4w9WgXcQ'), true);
  });

  it('mounts with currentTrack=null without throwing or constructing YT.Player, then loads when currentTrack is set', async () => {
    const initialVideoIdRef = { current: undefined };
    const isInitializedRef = { current: false };
    const isReadyRef = { current: false };
    const playerInstanceRef = { current: null };
    const containerRef = { current: {} };

    const constructedWith = [];
    const loadVideoByIdCalls = [];
    let currentLoadedId = '';

    const createPlayer = (targetVideoId) => {
      if (!targetVideoId) {
        throw new Error('Invalid video id');
      }
      constructedWith.push(targetVideoId);
      const mockPlayer = {
        getVideoUrl: () => (currentLoadedId ? `https://www.youtube.com/watch?v=${currentLoadedId}` : ''),
        loadVideoById: (arg) => {
          loadVideoByIdCalls.push(arg);
          currentLoadedId = arg.videoId;
        },
        playVideo: () => {},
      };
      // Simulate onReady firing synchronously and calling loadVideoById if not yet loaded
      isReadyRef.current = true;
      mockPlayer.loadVideoById({ videoId: targetVideoId, startSeconds: 0 });
      return mockPlayer;
    };

    // 1. Mount with currentTrack = null -> no exception, player not constructed
    const firstMount = await initOrSyncYouTubePlayer({
      currentTrack: null,
      initialVideoIdRef,
      isInitializedRef,
      isReadyRef,
      playerInstanceRef,
      containerRef,
      loadAPI: async () => {},
      createPlayer,
      resumeFromFallback: () => null,
    });

    assert.equal(firstMount.initialized, false);
    assert.equal(firstMount.loaded, false);
    assert.equal(constructedWith.length, 0);
    assert.equal(loadVideoByIdCalls.length, 0);

    // 2. Set currentTrack -> constructs player and calls loadVideoById
    const secondRender = await initOrSyncYouTubePlayer({
      currentTrack: { videoId: '_SVxbdQR6Eg', title: 'Track 1' },
      initialVideoIdRef,
      isInitializedRef,
      isReadyRef,
      playerInstanceRef,
      containerRef,
      loadAPI: async () => {},
      createPlayer,
      resumeFromFallback: () => null,
    });

    assert.equal(secondRender.initialized, true);
    assert.equal(secondRender.loaded, true);
    assert.deepEqual(constructedWith, ['_SVxbdQR6Eg']);
    assert.equal(loadVideoByIdCalls.length, 1);
    assert.deepEqual(loadVideoByIdCalls[0], { videoId: '_SVxbdQR6Eg', startSeconds: 0 });

    // 3. Switch to another track while ready -> calls loadVideoById directly
    const thirdRender = await initOrSyncYouTubePlayer({
      currentTrack: { videoId: 'dQw4w9WgXcQ', title: 'Track 2' },
      initialVideoIdRef,
      isInitializedRef,
      isReadyRef,
      playerInstanceRef,
      containerRef,
      loadAPI: async () => {},
      createPlayer,
      resumeFromFallback: () => 42,
    });

    assert.equal(thirdRender.initialized, true);
    assert.equal(thirdRender.loaded, true);
    assert.equal(loadVideoByIdCalls.length, 2);
    assert.deepEqual(loadVideoByIdCalls[1], { videoId: 'dQw4w9WgXcQ', startSeconds: 42 });
  });
});
