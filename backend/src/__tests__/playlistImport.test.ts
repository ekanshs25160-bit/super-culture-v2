import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index.js';
import { env } from '../config/env.js';
import { musicController } from '../controllers/musicController.js';

describe('Playlist Import API Suite (POST /api/music/import)', () => {
  const originalPasscode = env.appPasscode;

  before(() => {
    env.appPasscode = ''; // Deactivate passcode for tests
  });

  after(() => {
    env.appPasscode = originalPasscode;
  });

  it('rejects missing or non-array tracklist with HTTP 400', async () => {
    const res1 = await request(app)
      .post('/api/music/import')
      .send({});
    assert.equal(res1.status, 400);
    assert.equal(res1.body.error, 'tracklist array of strings is required');

    const res2 = await request(app)
      .post('/api/music/import')
      .send({ tracklist: 'Kendrick Lamar - DNA' });
    assert.equal(res2.status, 400);
  });

  it('handles empty tracklist returning empty success response', async () => {
    const res = await request(app)
      .post('/api/music/import')
      .send({ tracklist: [] });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.deepEqual(res.body.tracks, []);
    assert.equal(res.body.matchedCount, 0);
    assert.equal(res.body.totalRequested, 0);
  });

  it('limits tracklist queries to maximum 20 items per request', async () => {
    // Generate 25 track query strings
    const queries = Array.from({ length: 25 }, (_, i) => `Artist ${i} - Song ${i}`);

    // Stub searchMusicCatalogCached on controller to verify capping
    const originalSearchCached = musicController.searchMusicCatalogCached;
    let searchCount = 0;
    (musicController as any).searchMusicCatalogCached = async (query: string) => {
      searchCount++;
      return {
        id: `vid-${searchCount}`,
        videoId: `vid-${searchCount}`,
        title: query,
        artist: 'Test Artist',
        cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
        duration: 210,
        durationFormatted: '3:30',
      };
    };

    try {
      const res = await request(app)
        .post('/api/music/import')
        .send({ tracklist: queries });

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.totalRequested, 20); // capped at 20
      assert.equal(res.body.matchedCount, 20);
      assert.equal(searchCount, 20);
    } finally {
      (musicController as any).searchMusicCatalogCached = originalSearchCached;
    }
  });

  it('matches track titles, filters out failed lookups, and returns normalized tracks', async () => {
    const originalSearchCached = musicController.searchMusicCatalogCached;
    (musicController as any).searchMusicCatalogCached = async (query: string) => {
      if (query.includes('Nonexistent')) return null;
      return {
        id: `mock-${query.toLowerCase().replace(/\s+/g, '-')}`,
        videoId: `mock-${query.toLowerCase().replace(/\s+/g, '-')}`,
        title: query,
        artist: 'Mock Artist',
        cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
        duration: 240,
        durationFormatted: '4:00',
      };
    };

    try {
      const res = await request(app)
        .post('/api/music/import')
        .send({
          tracklist: [
            'Burial - Archangel',
            'Nonexistent Track 404',
            'Frank Ocean - Nights',
          ],
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.totalRequested, 3);
      assert.equal(res.body.matchedCount, 2);
      assert.equal(res.body.tracks[0].videoId, 'mock-burial---archangel');
      assert.equal(res.body.tracks[1].videoId, 'mock-frank-ocean---nights');
    } finally {
      (musicController as any).searchMusicCatalogCached = originalSearchCached;
    }
  });
});
