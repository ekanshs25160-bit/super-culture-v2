import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index.js';
import { env } from '../config/env.js';
import { getDatabase } from '../config/db.js';

describe('Playlist Batch & Track Persistence Suite', () => {
  const originalPasscode = env.appPasscode;

  before(() => {
    env.appPasscode = '';
  });

  after(() => {
    env.appPasscode = originalPasscode;
  });

  it('adds a single track and batch tracks to a playlist, persisting order, artist, and duration', async () => {
    const user = 'user-batch-test-1';

    // 1. Create a playlist
    const createRes = await request(app)
      .post('/api/library/playlists')
      .set('x-guest-id', user)
      .send({ name: 'Batch Test Playlist', description: 'Testing batch persistence' });

    assert.equal(createRes.status, 201);
    const playlistId = createRes.body.playlist.id;
    assert.ok(playlistId);

    // 2. Add single track
    const singleTrackRes = await request(app)
      .post(`/api/library/playlists/${playlistId}/tracks`)
      .set('x-guest-id', user)
      .send({
        videoId: 'vid-single-1',
        title: 'Single Track',
        artist: 'Single Artist',
        thumbnailUrl: 'https://example.com/cover1.jpg',
        duration: 180,
      });

    assert.equal(singleTrackRes.status, 201);
    assert.equal(singleTrackRes.body.ok, true);
    assert.equal(singleTrackRes.body.track.videoId, 'vid-single-1');
    assert.equal(singleTrackRes.body.track.position, 0);

    // 3. Add batch tracks
    const batchRes = await request(app)
      .post(`/api/library/playlists/${playlistId}/tracks/batch`)
      .set('x-guest-id', user)
      .send({
        tracks: [
          {
            videoId: 'vid-batch-2',
            title: 'Batch Track 2',
            artist: 'Batch Artist 2',
            cover: 'https://example.com/cover2.jpg',
            duration: '3:45',
            addedAt: Date.now() + 10,
          },
          {
            videoId: 'vid-batch-3',
            title: 'Batch Track 3',
            artist: 'Batch Artist 3',
            thumbnailUrl: 'https://example.com/cover3.jpg',
            durationMs: 215000,
            addedAt: Date.now() + 20,
          },
        ],
      });

    assert.equal(batchRes.status, 200);
    assert.equal(batchRes.body.ok, true);
    assert.equal(batchRes.body.count, 2);

    // 4. Retrieve library overview and verify playlist has all 3 tracks in order with duration and addedAt
    const overviewRes = await request(app)
      .get('/api/library/overview')
      .set('x-guest-id', user);

    assert.equal(overviewRes.status, 200);
    const targetPlaylist = overviewRes.body.playlists.find((p: any) => p.id === playlistId);
    assert.ok(targetPlaylist, 'Playlist should exist in overview');
    assert.equal(targetPlaylist.tracks.length, 3);

    assert.equal(targetPlaylist.tracks[0].videoId, 'vid-single-1');
    assert.equal(targetPlaylist.tracks[0].artist, 'Single Artist');
    assert.equal(targetPlaylist.tracks[0].duration, 180);

    assert.equal(targetPlaylist.tracks[1].videoId, 'vid-batch-2');
    assert.equal(targetPlaylist.tracks[1].artist, 'Batch Artist 2');
    assert.equal(targetPlaylist.tracks[1].duration, 225); // 3*60 + 45

    assert.equal(targetPlaylist.tracks[2].videoId, 'vid-batch-3');
    assert.equal(targetPlaylist.tracks[2].artist, 'Batch Artist 3');
    assert.equal(targetPlaylist.tracks[2].duration, 215); // Math.round(215000/1000)
  });

  it('prevents batch adding to non-existent playlist or playlist owned by another user', async () => {
    const owner = 'user-owner-batch';
    const stranger = 'user-stranger-batch';

    const createRes = await request(app)
      .post('/api/library/playlists')
      .set('x-guest-id', owner)
      .send({ name: 'Owner Playlist' });

    const playlistId = createRes.body.playlist.id;

    // Stranger tries to batch add
    const forbiddenBatchRes = await request(app)
      .post(`/api/library/playlists/${playlistId}/tracks/batch`)
      .set('x-guest-id', stranger)
      .send({
        tracks: [{ videoId: 'hacked-vid', title: 'Hacked' }],
      });

    assert.equal(forbiddenBatchRes.status, 404);

    // Invalid payload
    const invalidBatchRes = await request(app)
      .post(`/api/library/playlists/${playlistId}/tracks/batch`)
      .set('x-guest-id', owner)
      .send({ tracks: [] });

    assert.equal(invalidBatchRes.status, 400);
  });
});
