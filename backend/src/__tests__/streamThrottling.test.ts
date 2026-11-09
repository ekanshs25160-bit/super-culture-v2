import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Readable } from 'node:stream';
import axios from 'axios';
import request from 'supertest';
import { app } from '../index.js';
import { ytService } from '../services/ytService.js';
import { createStreamToken } from '../services/tokenService.js';
import { CHUNK_SIZE } from '../services/chunkedProxy.js';

describe('Stream Throttling Classification Suite (A1)', () => {
  const originalFetch = globalThis.fetch;
  const originalResolve = ytService.resolveAudioStream.bind(ytService);
  const originalGetClient = ytService.getClient.bind(ytService);

  after(() => {
    globalThis.fetch = originalFetch;
    ytService.resolveAudioStream = originalResolve;
    ytService.getClient = originalGetClient;
  });

  function createMockUpstream(totalSize: number, cutoffByte: number | null) {
    const requestedRanges: string[] = [];
    const fetchMock = async (_url: any, init?: any) => {
      const rangeHeader: string = init?.headers?.Range || '';
      requestedRanges.push(rangeHeader);
      const m = /^bytes=(\d+)-(\d+)$/.exec(rangeHeader);
      if (!m) {
        return new Response(null, { status: 400 });
      }
      const start = parseInt(m[1], 10);
      const end = parseInt(m[2], 10);
      if (cutoffByte !== null && (start > cutoffByte || end > cutoffByte)) {
        return new Response(null, { status: 403, statusText: 'Forbidden' });
      }
      const len = end - start + 1;
      return new Response(new Uint8Array(len), {
        status: 206,
        headers: {
          'content-range': `bytes ${start}-${end}/${totalSize}`,
          'content-length': String(len),
        },
      });
    };
    return { fetchMock, requestedRanges };
  }

  describe('ytService.probeStreamUrl', () => {
    it('returns { ok: false, throttled: false } when initial 0-1 probe fails', async () => {
      globalThis.fetch = async () => new Response(null, { status: 404 });

      const res = await ytService.probeStreamUrl('https://example.com/stream', 'IOS');
      assert.deepEqual(res, { ok: false, throttled: false });
    });

    it('returns { ok: true, throttled: false } for a 900 KB file on a mock upstream that 403s past 1,071,000 bytes', async () => {
      const fileSize = 900 * 1024; // 921,600 B (<= 1,100,000)
      const { fetchMock, requestedRanges } = createMockUpstream(fileSize, 1_071_000);
      globalThis.fetch = fetchMock as any;

      const res = await ytService.probeStreamUrl('https://example.com/900kb', 'IOS');
      assert.deepEqual(res, { ok: true, throttled: false });
      assert.deepEqual(requestedRanges, ['bytes=0-1']);
    });

    it('returns { ok: true, throttled: true } for a 4 MB file on a mock upstream that 403s past 1,071,000 bytes', async () => {
      const fileSize = 4 * 1024 * 1024; // 4,194,304 B
      const { fetchMock, requestedRanges } = createMockUpstream(fileSize, 1_071_000);
      globalThis.fetch = fetchMock as any;

      const res = await ytService.probeStreamUrl('https://example.com/4mb-throttled', 'IOS');
      assert.deepEqual(res, { ok: true, throttled: true });
      assert.equal(requestedRanges[0], 'bytes=0-1');
      assert.equal(requestedRanges[1], `bytes=${fileSize - 64}-${fileSize - 1}`);
    });

    it('returns { ok: true, throttled: false } for an unthrottled 4 MB mock (probes tail and 1.5 MiB)', async () => {
      const fileSize = 4 * 1024 * 1024; // 4,194,304 B (> 2,097,152)
      const { fetchMock, requestedRanges } = createMockUpstream(fileSize, null);
      globalThis.fetch = fetchMock as any;

      const res = await ytService.probeStreamUrl('https://example.com/4mb-unthrottled', 'IOS');
      assert.deepEqual(res, { ok: true, throttled: false });
      assert.deepEqual(requestedRanges, [
        'bytes=0-1',
        `bytes=${fileSize - 64}-${fileSize - 1}`,
        'bytes=1572864-1572900',
      ]);
    });

    it('returns { ok: true, throttled: true } if tail passes but 1.5 MiB probe returns 403', async () => {
      const fileSize = 4 * 1024 * 1024;
      globalThis.fetch = (async (_url: any, init?: any) => {
        const range = init?.headers?.Range;
        if (range === 'bytes=0-1') {
          return new Response(new Uint8Array(2), {
            status: 206,
            headers: { 'content-range': `bytes 0-1/${fileSize}` },
          });
        }
        if (range === `bytes=${fileSize - 64}-${fileSize - 1}`) {
          return new Response(new Uint8Array(64), {
            status: 206,
            headers: { 'content-range': `bytes ${fileSize - 64}-${fileSize - 1}/${fileSize}` },
          });
        }
        if (range === 'bytes=1572864-1572900') {
          return new Response(null, { status: 403 });
        }
        return new Response(null, { status: 400 });
      }) as any;

      const res = await ytService.probeStreamUrl('https://example.com/mid-fail', 'IOS');
      assert.deepEqual(res, { ok: true, throttled: true });
    });
  });

  describe('Negative caching (30 min) and STREAM_LIMITED response when every client is throttled', () => {
    it('caches STREAM_LIMITED for 30 minutes when all clients are throttled and returns { code: "STREAM_LIMITED", reason } from POST /api/music/stream-url', async () => {
      const videoId = 'all-throttled-vid';
      ytService.invalidateStreamCache(videoId);

      const fileSize = 4 * 1024 * 1024;
      const { fetchMock } = createMockUpstream(fileSize, 1_071_000);
      globalThis.fetch = fetchMock as any;

      const fakeFormat = {
        url: 'https://example.com/throttled.m4a',
        mime_type: 'audio/mp4; codecs="mp4a.40.2"',
        bitrate: 128000,
        has_audio: true,
      };
      const fakeInfo = {
        streaming_data: { adaptive_formats: [fakeFormat] },
        chooseFormat: () => fakeFormat,
      };

      ytService.getClient = async () =>
        ({
          getBasicInfo: async () => fakeInfo,
          music: { getInfo: async () => fakeInfo },
          session: { player: {} },
        }) as any;

      ytService.resolveAudioStream = originalResolve;

      const beforeMs = Date.now();
      const res = await request(app)
        .post('/api/music/stream-url')
        .send({ videoId, prefer: 'aac' });

      assert.equal(res.status, 200);
      assert.equal(res.body.throttled, true);
      assert.equal(res.body.code, 'STREAM_LIMITED');
      assert.equal(typeof res.body.reason, 'string');
      assert(res.body.reason.length > 0);
      assert(res.body.url.includes(`/api/yt/stream/${videoId}`));

      // Verify 30-minute negative cache entry in ytService.streamCache
      const cached = ytService.streamCache.get(`${videoId}:aac`);
      assert(cached, 'Negative cache entry must exist');
      assert.equal(cached.throttled, true);
      assert.equal(cached.code, 'STREAM_LIMITED');
      const ttlRemaining = cached.expiresAt - beforeMs;
      assert(
        ttlRemaining >= 29 * 60 * 1000 && ttlRemaining <= 31 * 60 * 1000,
        `Expected ~30 min negative cache TTL, got ${ttlRemaining}ms`
      );
    });

    it('returns throttled: false without STREAM_LIMITED when stream is unthrottled', async () => {
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
      assert.equal(res.body.code, undefined);
      assert(res.body.url.includes('/api/yt/stream/clean-track-id'));
    });
  });

  describe('Mid-stream chunk failure socket destruction (A2)', () => {
    const originalAxiosGet = axios.get;

    after(() => {
      axios.get = originalAxiosGet;
    });

    it('destroys res.socket when chunk 2 fails after headers sent so response ends within 1s with fewer bytes than Content-Length', async () => {
      const totalSize = 2_500_000;
      const videoId = 'chunk2-fail-vid';
      const token = createStreamToken(videoId);

      ytService.resolveAudioStream = async () => ({
        videoId,
        url: 'https://fake-cdn.googlevideo.com/chunk2-fail',
        mimeType: 'audio/mp4; codecs="mp4a.40.2"',
        bitrate: 128000,
        expiresAt: Date.now() + 3600000,
        throttled: false,
      });

      axios.get = (async (_url: string, config: any) => {
        const range: string = config?.headers?.Range || '';
        if (range === 'bytes=0-1') {
          return {
            status: 206,
            headers: {
              'content-range': `bytes 0-1/${totalSize}`,
              'content-length': '2',
            },
            data: Readable.from([Buffer.alloc(2)]),
          };
        }
        if (range === `bytes=0-${CHUNK_SIZE - 1}`) {
          return {
            status: 206,
            headers: {
              'content-range': `bytes 0-${CHUNK_SIZE - 1}/${totalSize}`,
              'content-length': String(CHUNK_SIZE),
            },
            data: Readable.from([Buffer.alloc(CHUNK_SIZE, 0x61)]),
          };
        }
        // Chunk 2 fails with 403 Forbidden
        const err: any = new Error('Request failed with status code 403');
        err.response = { status: 403, data: Readable.from([]) };
        throw err;
      }) as any;

      const srv = http.createServer(app);
      await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', () => resolve()));
      const addr = srv.address() as { port: number };

      try {
        const startMs = Date.now();
        const result = await new Promise<{
          statusCode: number;
          contentLength: number;
          bytesReceived: number;
          elapsedMs: number;
        }>((resolve, reject) => {
          const req = http.get(
            `http://127.0.0.1:${addr.port}/api/yt/stream/${videoId}?t=${encodeURIComponent(token)}`,
            (res) => {
              const contentLength = Number(res.headers['content-length'] || 0);
              let bytesReceived = 0;
              let settled = false;
              const finish = () => {
                if (settled) return;
                settled = true;
                resolve({
                  statusCode: res.statusCode || 0,
                  contentLength,
                  bytesReceived,
                  elapsedMs: Date.now() - startMs,
                });
              };
              res.on('data', (chunk: Buffer) => {
                bytesReceived += chunk.length;
              });
              res.on('end', finish);
              res.on('aborted', finish);
              res.on('close', finish);
              res.on('error', finish);
            }
          );
          req.on('error', (err) => {
            // ECONNRESET after partial body is also a valid immediate termination
            reject(err);
          });
        });

        assert.equal(result.statusCode, 200);
        assert.equal(result.contentLength, totalSize);
        assert(
          result.elapsedMs < 1000,
          `Expected response to terminate within 1000ms, took ${result.elapsedMs}ms`
        );
        assert(
          result.bytesReceived < result.contentLength,
          `Expected fewer bytes (${result.bytesReceived}) than Content-Length (${result.contentLength})`
        );
        assert(result.bytesReceived <= CHUNK_SIZE);
      } finally {
        await new Promise<void>((resolve) => srv.close(() => resolve()));
      }
    });
  });

  describe('B1 & B3: Configurable client order and VISIONOS unthrottled resolution', () => {
    it('tries clients in configurable YT_CLIENT_ORDER and selects the first client passing A1 tail + 1.5 MiB probes', async () => {
      ytService.resolveAudioStream = originalResolve;
      ytService.getClient = originalGetClient;
      const savedEnv = process.env.YT_CLIENT_ORDER;
      const savedFetchVision = ytService.fetchVisionOsInfo.bind(ytService);
      const savedProbe = ytService.probeStreamUrl.bind(ytService);
      try {
        process.env.YT_CLIENT_ORDER = 'VISIONOS,IOS,MWEB,MUSIC';
        ytService.fetchVisionOsInfo = async () => ({
          playability_status: { status: 'OK' },
          streaming_data: {
            adaptive_formats: [
              {
                itag: 140,
                url: 'https://fake-visionos-cdn.googlevideo.com/videoplayback?c=VISIONOS',
                mime_type: 'audio/mp4; codecs="mp4a.40.2"',
                bitrate: 128000,
                content_length: 4144911,
                has_audio: true,
              },
            ],
          },
        });
        ytService.probeStreamUrl = async (url: string, clientName: string) => ({
          ok: true,
          throttled: clientName !== 'VISIONOS' || !url.includes('VISIONOS'),
        });

        const entry = await ytService.resolveAudioStream('visionos-test-id', 'aac');
        assert.equal(entry.client, 'VISIONOS');
        assert.equal(entry.throttled, false);
        assert.equal(entry.url, 'https://fake-visionos-cdn.googlevideo.com/videoplayback?c=VISIONOS');
      } finally {
        if (savedEnv === undefined) {
          delete process.env.YT_CLIENT_ORDER;
        } else {
          process.env.YT_CLIENT_ORDER = savedEnv;
        }
        ytService.fetchVisionOsInfo = savedFetchVision;
        ytService.probeStreamUrl = savedProbe;
      }
    });
  });
});
