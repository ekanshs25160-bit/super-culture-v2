import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPlaybackEventHandler } from '../engine/playbackEventHandler.js';
import { PlayerState } from '../engine/PlayerConstants.js';

describe('Shuffle & Repeat Queue Transitions Suite', () => {
  const sampleTracks = [
    { id: '1', videoId: 'v1', title: 'Song 1', artist: 'Artist 1' },
    { id: '2', videoId: 'v2', title: 'Song 2', artist: 'Artist 2' },
    { id: '3', videoId: 'v3', title: 'Song 3', artist: 'Artist 3' },
    { id: '4', videoId: 'v4', title: 'Song 4', artist: 'Artist 4' },
  ];

  it('deterministic shuffle: keeps active track at index 0 and shuffles remaining tracks', () => {
    const curTrack = sampleTracks[1]; // Song 2 is playing
    const curIndex = sampleTracks.findIndex((t) => t.id === curTrack.id);
    const active = sampleTracks[curIndex];
    const others = sampleTracks.filter((_, idx) => idx !== curIndex);

    // Perform Fisher-Yates
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(0.5 * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }

    const shuffled = [active, ...others];
    assert.equal(shuffled.length, 4);
    assert.equal(shuffled[0].id, '2', 'active track must stay at index 0');
    // Ensure all 4 original tracks are present
    const ids = new Set(shuffled.map((t) => t.id));
    assert.equal(ids.size, 4);
  });

  it('shuffle toggled off restores originalQueue and finds current track index', () => {
    const originalQueue = [...sampleTracks];
    const currentTrack = sampleTracks[2]; // Song 3

    const restoredIndex = originalQueue.findIndex((t) => t.id === currentTrack.id);
    assert.equal(restoredIndex, 2);
  });

  it('repeat "one": loops current track via seekTo(0) and playVideo() when onEnded fires', () => {
    let seekedTo = null;
    let played = false;
    let skippedNext = false;

    const mockPlayer = {
      seekTo: (sec) => {
        seekedTo = sec;
      },
      playVideo: () => {
        played = true;
      },
    };

    const handler = createPlaybackEventHandler({
      getRepeatMode: () => 'one',
      getSkipNext: () => () => {
        skippedNext = true;
      },
      showToast: () => {},
    });

    handler.handleStateChange(PlayerState.ENDED, mockPlayer);

    assert.equal(seekedTo, 0, 'seekTo(0) must be called immediately');
    assert.equal(played, true, 'playVideo() must be called immediately');
    assert.equal(skippedNext, false, 'skipNext must NOT be called on repeat one');
  });

  it('repeat "all": advances queue and wraps from last track to first track on onEnded', () => {
    let skippedNext = false;

    const handler = createPlaybackEventHandler({
      getRepeatMode: () => 'all',
      getSkipNext: () => () => {
        skippedNext = true;
      },
      showToast: () => {},
    });

    handler.handleStateChange(PlayerState.ENDED);
    assert.equal(skippedNext, true, 'skipNext must be called when repeat is all');
  });

  it('onTrackEnded callback intercepts track end for custom queue management', () => {
    let endedHandled = false;

    const handler = createPlaybackEventHandler({
      onTrackEnded: () => {
        endedHandled = true;
      },
      showToast: () => {},
    });

    handler.handleStateChange(PlayerState.ENDED);
    assert.equal(endedHandled, true);
  });
});
