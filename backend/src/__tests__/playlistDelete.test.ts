import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index.js';
import { env } from '../config/env.js';
import { getDatabase } from '../config/db.js';

describe('Playlist Deletion API Suite (DELETE /api/library/playlists/:playlistId)', () => {
  const originalPasscode = env.appPasscode;

  before(() => {
    env.appPasscode = ''; // Deactivate passcode for tests
  });

  after(() => {
    env.appPasscode = originalPasscode;
  });

  it('creates a playlist, deletes it successfully with 200, and returns 404 on subsequent deletion', async () => {
    const userA = 'user-delete-test-a';

    // 1. Create playlist
    const createRes = await request(app)
      .post('/api/library/playlists')
      .set('x-guest-id', userA)
      .send({ name: 'Playlist To Delete', description: 'Testing deletion' });

    assert.equal(createRes.status, 201);
    const playlistId = createRes.body.playlist.id;
    assert.ok(playlistId);

    // 2. Delete playlist
    const deleteRes = await request(app)
      .delete(`/api/library/playlists/${playlistId}`)
      .set('x-guest-id', userA);

    assert.equal(deleteRes.status, 200);
    assert.deepEqual(deleteRes.body, { ok: true });

    // 3. Delete again -> 404
    const deleteAgainRes = await request(app)
      .delete(`/api/library/playlists/${playlistId}`)
      .set('x-guest-id', userA);

    assert.equal(deleteAgainRes.status, 404);
    assert.equal(deleteAgainRes.body.error, 'Playlist not found');
  });

  it('prevents another user from deleting a playlist they do not own (returns 404)', async () => {
    const owner = 'user-owner-123';
    const unauthorizedUser = 'user-attacker-456';

    // 1. Create playlist by owner
    const createRes = await request(app)
      .post('/api/library/playlists')
      .set('x-guest-id', owner)
      .send({ name: 'Owner Only Playlist' });

    assert.equal(createRes.status, 201);
    const playlistId = createRes.body.playlist.id;

    // 2. Unauthorized user attempts deletion -> 404
    const deleteRes = await request(app)
      .delete(`/api/library/playlists/${playlistId}`)
      .set('x-guest-id', unauthorizedUser);

    assert.equal(deleteRes.status, 404);
    assert.equal(deleteRes.body.error, 'Playlist not found');

    // 3. Verify owner can still delete it
    const ownerDeleteRes = await request(app)
      .delete(`/api/library/playlists/${playlistId}`)
      .set('x-guest-id', owner);

    assert.equal(ownerDeleteRes.status, 200);
  });

  it('removes a track from a playlist successfully', async () => {
    const user = 'user-track-remove-test';

    // 1. Create playlist
    const createRes = await request(app)
      .post('/api/library/playlists')
      .set('x-guest-id', user)
      .send({ name: 'Playlist with Track' });

    const playlistId = createRes.body.playlist.id;

    // Insert track into DB
    const db = getDatabase();
    const videoId = 'test-vid-123';
    db.prepare(`
      INSERT INTO playlist_tracks (id, playlist_id, video_id, title, artist, thumbnail_url, duration, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('pt-uuid-1', playlistId, videoId, 'Sample Title', 'Sample Artist', 'https://example.com/cover.jpg', 180, 0);

    // 2. Verify track is in DB
    const countBefore = (db.prepare('SELECT count(*) as count FROM playlist_tracks WHERE playlist_id = ?').get(playlistId) as any).count;
    assert.equal(countBefore, 1);

    // 3. Remove track via API
    const removeRes = await request(app)
      .delete(`/api/library/playlists/${playlistId}/tracks/${videoId}`)
      .set('x-guest-id', user);

    assert.equal(removeRes.status, 200);
    assert.deepEqual(removeRes.body, { ok: true });

    // 4. Verify track is removed from DB
    const countAfter = (db.prepare('SELECT count(*) as count FROM playlist_tracks WHERE playlist_id = ?').get(playlistId) as any).count;
    assert.equal(countAfter, 0);
  });
});
