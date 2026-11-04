import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import request from 'supertest';
import axios from 'axios';
import { app } from '../index.js';
import { env } from '../config/env.js';
import { cacheService } from '../services/cacheService.js';
import { aiBudgetService } from '../services/aiBudgetService.js';
import { createStreamToken, verifyStreamToken } from '../services/tokenService.js';
import { ytService } from '../services/ytService.js';

describe('Super Culture v2.0 - Backend Hardening & Speed Suite', () => {
  const originalPasscode = env.appPasscode;

  after(() => {
    env.appPasscode = originalPasscode;
    aiBudgetService.setLimitForTesting(null);
    cacheService.clear();
    setTimeout(() => process.exit(0), 100);
  });

  describe('1. CORS Access Control & Rejection', () => {
    it('rejects requests from unauthorized external origins with 403', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://malicious-hacker-site.com');

      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'CORS origin not allowed');
    });

    it('allows requests from localhost in development/test environment', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');

      assert.equal(res.status, 200);
      assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    });

    it('allows requests from deployed Render frontend with credentials and headers', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://super-culture-v2.onrender.com');

      assert.equal(res.status, 200);
      assert.equal(res.headers['access-control-allow-origin'], 'https://super-culture-v2.onrender.com');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    });

    it('handles preflight OPTIONS requests for Render frontend', async () => {
      const res = await request(app)
        .options('/api/music/home-shelves')
        .set('Origin', 'https://super-culture-v2.onrender.com')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'x-guest-id,content-type');

      assert.equal(res.status, 204);
      assert.equal(res.headers['access-control-allow-origin'], 'https://super-culture-v2.onrender.com');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    });

    it('allows server-to-server or probe requests without Origin header', async () => {
      const res = await request(app).get('/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
    });
  });

  describe('2. Optional Passcode Gate & Cookie Authentication', () => {
    const TEST_PASSCODE = 'culture-vip-2026';

    before(() => {
      env.appPasscode = TEST_PASSCODE;
    });

    after(() => {
      env.appPasscode = originalPasscode;
    });

    it('blocks access to protected /api routes when passcode is configured and cookie is missing', async () => {
      const res = await request(app).get('/api/music/home-shelves');
      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'Passcode authentication required');
      assert.equal(res.body.authRequired, true);
    });

    it('allows liveness /health and readiness /ready probes without passcode', async () => {
      const healthRes = await request(app).get('/health');
      assert.equal(healthRes.status, 200);
      assert.equal(healthRes.body.status, 'ok');

      const readyRes = await request(app).get('/ready');
      assert.equal(readyRes.status, 200);
      assert.equal(readyRes.body.status, 'ready');
      assert.equal(readyRes.body.database, 'connected');
    });

    it('returns 401 when invalid passcode is submitted', async () => {
      const res = await request(app)
        .post('/api/auth/passcode')
        .send({ passcode: 'incorrect-passcode' });

      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'Invalid passcode');
    });

    it('validates correct passcode, sets signed httpOnly cookie, and unlocks protected /api routes', async () => {
      const authRes = await request(app)
        .post('/api/auth/passcode')
        .send({ passcode: TEST_PASSCODE });

      assert.equal(authRes.status, 200);
      assert.equal(authRes.body.authenticated, true);

      const cookies = authRes.headers['set-cookie'];
      assert(Array.isArray(cookies), 'Set-Cookie header should be an array');
      const authCookie = cookies.find((c: string) => c.startsWith('sc_passcode='));
      assert(authCookie, 'sc_passcode cookie must be present');
      assert(authCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');

      // Now request protected endpoint with the received signed cookie
      const protectedRes = await request(app)
        .get('/api/music/home-shelves')
        .set('Cookie', authCookie);

      assert.equal(protectedRes.status, 200);
      assert(Array.isArray(protectedRes.body.shelves), 'Shelves data returned');
    });
  });

  describe('3. Rate Limiting (429 Enforcement)', () => {
    it('returns HTTP 429 when passcode attempt rate limit is exceeded', async () => {
      // The authRateLimiter has max 5 attempts per window.
      // We send 6 consecutive requests to trigger the 429 limiter.
      let lastResponse: request.Response | null = null;
      for (let i = 0; i < 6; i++) {
        lastResponse = await request(app)
          .post('/api/auth/passcode')
          .send({ passcode: 'attempt' });
      }

      assert(lastResponse !== null);
      assert.equal(lastResponse.status, 429);
      assert(
        lastResponse.body.error.includes('Too many') ||
        lastResponse.body.error.includes('limit'),
        'Must contain rate limit error message'
      );
    });
  });

  describe('4. Global AI Daily Budget Counter (429 Exceeded)', () => {
    before(() => {
      env.appPasscode = ''; // Deactivate passcode for AI testing
      aiBudgetService.setLimitForTesting(0);
      aiBudgetService.resetForTesting(0);
    });

    after(() => {
      aiBudgetService.setLimitForTesting(null);
    });

    it('enforces MAX_AI_CALLS_PER_DAY and returns 429 when daily budget is exhausted', async () => {
      const res = await request(app)
        .post('/api/ai/vibe')
        .send({ mood: 'Chill', genre: 'Ambient' });
      assert.equal(res.status, 429);
      assert.equal(res.body.error, 'Daily AI call budget exceeded');
      assert.equal(res.body.limit, 0);
    });

    it('rejects invalid inputs with Zod validation errors (400)', async () => {
      const res = await request(app)
        .post('/api/ai/log-history')
        .send({ song: { title: '' } }); // empty title violates z.string().min(1)

      assert.equal(res.status, 400);
      assert(res.body.error.includes('Valid song object required'));
    });
  });

  describe('5. Shelves LRU Caching & Stale-While-Revalidate', () => {
    before(() => {
      env.appPasscode = '';
      cacheService.clear();
    });

    it('serves first call as cold cache MISS and second call as instant cache HIT', async () => {
      // 1st Call: Cold miss
      const res1 = await request(app).get('/api/music/home-shelves');
      assert.equal(res1.status, 200);
      assert.equal(res1.headers['x-cache'], 'MISS');
      assert(
        res1.headers['cache-control'].includes('max-age=900') &&
        res1.headers['cache-control'].includes('stale-while-revalidate=1800'),
        'Must send Cache-Control headers with public max-age and s-w-r'
      );
      assert(Array.isArray(res1.body.shelves));

      // 2nd Call: Served from in-memory LRU cache
      const res2 = await request(app).get('/api/music/home-shelves');
      assert.equal(res2.status, 200);
      assert.equal(res2.headers['x-cache'], 'HIT');
      assert.deepEqual(res2.body, res1.body);
    });
  });

  describe('6. Stream URL Security, HMAC Tokens & Range 206 Handling', () => {
    const TEST_VIDEO_ID = 'test-stream-track-123';
    let originalResolve: any;
    let originalAxiosGet: any;

    before(() => {
      env.appPasscode = '';
      originalResolve = ytService.resolveAudioStream;
      originalAxiosGet = axios.get;

      ytService.resolveAudioStream = async (id: string, prefer?: 'aac' | 'best') => ({
        videoId: id,
        url: 'https://fake-cdn.googlevideo.com/videoplayback',
        mimeType: 'audio/mp4; codecs="mp4a.40.2"',
        bitrate: 128000,
        expiresAt: Date.now() + 3600000,
      });

      axios.get = (async (url: string, config: any) => {
        if (config?.headers?.Range) {
          return {
            status: 206,
            headers: {
              'content-range': 'bytes 0-1024/5000000',
              'content-length': '1025',
            },
            data: Readable.from([Buffer.alloc(1025)]),
          };
        }
        return {
          status: 200,
          headers: {
            'content-length': '5000000',
          },
          data: Readable.from([Buffer.alloc(100)]),
        };
      }) as any;
    });

    after(() => {
      ytService.resolveAudioStream = originalResolve;
      axios.get = originalAxiosGet;
    });

    it('generates signed stream URL with 5-minute expiry token via POST /api/music/stream-url', async () => {
      const res = await request(app)
        .post('/api/music/stream-url')
        .send({ videoId: TEST_VIDEO_ID, prefer: 'aac' });

      assert.equal(res.status, 200);
      assert(res.body.url.startsWith(`/api/yt/stream/${TEST_VIDEO_ID}?t=`));

      const token = res.body.url.split('?t=')[1];
      const verification = verifyStreamToken(TEST_VIDEO_ID, token);
      assert.equal(verification.valid, true);
      assert.equal(verification.expired, false);
    });

    it('rejects forged, tampered, or missing stream tokens with HTTP 403', async () => {
      // 1. Missing token
      const noTokenRes = await request(app).get(`/api/yt/stream/${TEST_VIDEO_ID}`);
      assert.equal(noTokenRes.status, 403);
      assert.equal(noTokenRes.body.error, 'Invalid or missing stream token');

      // 2. Forged / invalid signature token
      const forgedToken = `${Date.now() + 60000}.baddeadbeefsignature12345`;
      const forgedRes = await request(app).get(`/api/yt/stream/${TEST_VIDEO_ID}?t=${forgedToken}`);
      assert.equal(forgedRes.status, 403);
      assert.equal(forgedRes.body.error, 'Invalid or missing stream token');

      // 3. Valid token generated for a different videoId
      const otherToken = createStreamToken('different-video-id');
      const wrongIdRes = await request(app).get(`/api/yt/stream/${TEST_VIDEO_ID}?t=${otherToken}`);
      assert.equal(wrongIdRes.status, 403);
    });

    it('rejects expired stream tokens with HTTP 410 (Gone)', async () => {
      // Create token that expired 10 seconds ago
      const expiredToken = createStreamToken(TEST_VIDEO_ID, -10000);
      const res = await request(app).get(`/api/yt/stream/${TEST_VIDEO_ID}?t=${expiredToken}`);

      assert.equal(res.status, 410);
      assert.equal(res.body.error, 'Stream token expired');
    });

    it('supports Range requests returning HTTP 206 Partial Content, Content-Range, and private no-store cache headers', async () => {
      const validToken = createStreamToken(TEST_VIDEO_ID);
      const res = await request(app)
        .get(`/api/yt/stream/${TEST_VIDEO_ID}?t=${validToken}`)
        .set('Range', 'bytes=0-1024');

      assert.equal(res.status, 206);
      assert.equal(res.headers['content-range'], 'bytes 0-1024/5000000');
      assert.equal(res.headers['content-type'], 'audio/mp4; codecs="mp4a.40.2"');
      assert.equal(res.headers['cache-control'], 'private, no-store');
    });

    it('supports HEAD requests returning HTTP 206 status, Content-Range headers, and empty body', async () => {
      const validToken = createStreamToken(TEST_VIDEO_ID);
      const res = await request(app)
        .head(`/api/yt/stream/${TEST_VIDEO_ID}?t=${validToken}`)
        .set('Range', 'bytes=0-1024');

      assert.equal(res.status, 206);
      assert.equal(res.headers['content-range'], 'bytes 0-1024/5000000');
      assert.equal(res.headers['content-length'], '1025');
      assert.equal(res.text, undefined);
    });

    it('returns 502 with STREAM_UNAVAILABLE when resolver fails', async () => {
      const failingId = 'failing-video-id';
      const failingToken = createStreamToken(failingId);

      const savedResolve = ytService.resolveAudioStream;
      ytService.resolveAudioStream = async () => {
        throw new Error('Failed to extract signature decipher algorithm');
      };

      try {
        const res = await request(app).get(`/api/yt/stream/${failingId}?t=${failingToken}`);
        assert.equal(res.status, 502);
        assert.deepEqual(res.body, {
          code: 'STREAM_UNAVAILABLE',
          message: 'Unable to resolve audio stream for this track',
        });
      } finally {
        ytService.resolveAudioStream = savedResolve;
      }
    });

    it('GET /api/yt/selftest returns status 200 with ok: true when stream is accessible', async () => {
      const res = await request(app).get('/api/yt/selftest');
      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.status, 206);
    });
  });
});
