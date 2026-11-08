import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index.js';
import { ytService } from '../services/ytService.js';

describe('Stream Throttling Classification Suite', () => {
  const originalFetch = globalThis.fetch;
  const originalResolve = ytService.resolveAudioStream.bind(ytService);

  after(() => {
    globalThis.fetch = originalFetch;
    ytService.resolveAudioStream = originalResolve;
  });

  describe('ytService.probeStreamUrl', () => {
    it('returns { ok: false, throttled: false } when initial 0-1 probe fails', async () => {
      globalThis.fetch = async () =>
        new Response(null, { status: 404 });

      const res = await ytService.probeStreamUrl('https://example.com/stream', 'IOS');
      assert.deepEqual(res, { ok: false, throttled: false });
    });

    it('returns { ok: true, throttled: false } when file size <= 1048600', async () => {
      globalThis.fetch = async () =>
        new Response(new Uint8Array([0, 1]), {
          status: 206,
          headers: {
            'content-range': 'bytes 0-1/500000',
          },
        });

      const res = await ytService.probeStreamUrl('https://example.com/short', 'IOS');
      assert.deepEqual(res, { ok: true, throttled: false });
    });

    it('returns { ok: true, throttled: false } when deep probe at 1 MiB returns 206', async () => {
      let probeCount = 0;
      globalThis.fetch = async (_url, init: any) => {
        probeCount++;
        const range = init?.headers?.Range;
        if (range === 'bytes=0-1') {
          return new Response(new Uint8Array([0, 1]), {
            status: 206,
            headers: {
              'content-range': 'bytes 0-1/5000000',
            },
          });
        }
        if (range === 'bytes=1048576-1048600') {
          return new Response(new Uint8Array(25), {
            status: 206,
            headers: {
              'content-range': 'bytes 1048576-1048600/5000000',
            },
          });
        }
        return new Response(null, { status: 400 });
      };

      const res = await ytService.probeStreamUrl('https://example.com/unthrottled', 'IOS');
      assert.equal(probeCount, 2);
      assert.deepEqual(res, { ok: true, throttled: false });
    });

    it('returns { ok: true, throttled: true } when deep probe at 1 MiB returns 403 Forbidden', async () => {
      let probeCount = 0;
      globalThis.fetch = async (_url, init: any) => {
        probeCount++;
        const range = init?.headers?.Range;
        if (range === 'bytes=0-1') {
          return new Response(new Uint8Array([0, 1]), {
            status: 206,
            headers: {
              'content-range': 'bytes 0-1/5000000',
            },
          });
        }
        if (range === 'bytes=1048576-1048600') {
          return new Response(null, {
            status: 403,
            statusText: 'Forbidden',
          });
        }
        return new Response(null, { status: 400 });
      };

      const res = await ytService.probeStreamUrl('https://example.com/throttled', 'IOS');
      assert.equal(probeCount, 2);
      assert.deepEqual(res, { ok: true, throttled: true });
    });
  });

  describe('POST /api/music/stream-url throttled response', () => {
    it('returns throttled: true in JSON response when stream is throttled', async () => {
      ytService.resolveAudioStream = async () => ({
        videoId: 'throttled-track-id',
        url: 'https://example.com/throttled-stream',
        mimeType: 'audio/mp4; codecs="mp4a.40.2"',
        bitrate: 128000,
        expiresAt: Date.now() + 3600000,
        throttled: true,
      });

      const res = await request(app)
        .post('/api/music/stream-url')
        .send({ videoId: 'throttled-track-id', prefer: 'aac' });

      assert.equal(res.status, 200);
      assert.equal(res.body.throttled, true);
      assert(res.body.url.includes('/api/yt/stream/throttled-track-id'));
    });

    it('returns throttled: false in JSON response when stream is unthrottled', async () => {
      ytService.resolveAudioStream = async () => ({
        videoId: 'clean-track-id',
        url: 'https://example.com/clean-stream',
        mimeType: 'audio/mp4; codecs="mp4a.40.2"',
        bitrate: 128000,
        expiresAt: Date.now() + 3600000,
        throttled: false,
      });

      const res = await request(app)
        .post('/api/music/stream-url')
        .send({ videoId: 'clean-track-id', prefer: 'aac' });

      assert.equal(res.status, 200);
      assert.equal(res.body.throttled, false);
      assert(res.body.url.includes('/api/yt/stream/clean-track-id'));
    });
  });
});
