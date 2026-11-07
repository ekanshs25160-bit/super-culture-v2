import axios, { AxiosResponse } from 'axios';
import type { Request, Response } from 'express';
import { Readable, pipeline } from 'node:stream';
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 });

/**
 * Googlevideo URLs reject open-ended ("bytes=0-") and large Range requests with HTTP 403,
 * but accept small bounded ranges. Browsers' <audio> element sends open-ended ranges, so we
 * translate every browser request into sequential bounded upstream requests and stitch the
 * results into ONE response. Seeking, Safari's probe requests and plain GETs all work.
 */
export const CHUNK_SIZE = 1024 * 1024; // 1 MB: googlevideo 403s any range over ~1 MiB without a PO token

export interface ServeChunkedOptions {
  mimeType?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface ParsedRange {
  start: number | null;
  end: number | null;
}

export function parseRange(header: string | undefined): ParsedRange | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  return {
    start: m[1] === '' ? null : parseInt(m[1], 10),
    end: m[2] === '' ? null : parseInt(m[2], 10),
  };
}

export function parseTotal(contentRange: unknown): number | null {
  const m = /\/(\d+)\s*$/.exec(String(contentRange || ''));
  return m ? parseInt(m[1], 10) : null;
}

function fetchChunk(
  url: string,
  start: number,
  end: number,
  headers: Record<string, string>,
  signal?: AbortSignal
): Promise<AxiosResponse<Readable>> {
  return axios.get<Readable>(url, {
    headers: { ...headers, Range: `bytes=${start}-${end}` },
    responseType: 'stream',
    signal,
    httpAgent,
    httpsAgent,
    validateStatus: (s) => s === 200 || s === 206,
  });
}

/**
 * Serves one browser request. Throws BEFORE any response header is sent if the first upstream
 * chunk fails, so the caller can clear its cache, re-resolve the stream and retry once.
 * A failure in a later chunk can only destroy the response (headers are already sent).
 */
export async function serveChunked(
  req: Request,
  res: Response,
  upstreamUrl: string,
  opts: ServeChunkedOptions = {}
): Promise<void> {
  const { mimeType, headers = {}, signal } = opts;
  // 1. Probe for total length first so large chunk ends can be clamped to the file size
  const probe = await fetchChunk(upstreamUrl, 0, 1, headers, signal);
  const total = parseTotal(probe.headers['content-range']);
  probe.data.destroy();
  if (total == null) throw new Error('Unable to determine content length from upstream');

  // 2. Parse the browser range and clamp to total
  const range = parseRange(req.headers.range);
  let start = 0;
  let reqEnd = total - 1;

  if (range) {
    if (range.start === null) {
      start = Math.max(0, total - (range.end as number));
    } else {
      start = range.start;
      if (range.end !== null) reqEnd = Math.min(range.end, total - 1);
    }
  }

  if (start > total - 1) {
    res.status(416).setHeader('Content-Range', `bytes */${total}`);
    res.end();
    return;
  }

  // 3. Clamp the first fetch chunk to the file boundary
  const firstEnd = Math.min(reqEnd, start + CHUNK_SIZE - 1);

  let first: AxiosResponse<Readable>;
  try {
    first = await fetchChunk(upstreamUrl, start, firstEnd, headers, signal);
  } catch (err: any) {
    if (err?.response?.status === 416) {
      err.response.data?.destroy?.();
      res.status(416).setHeader('Content-Range', `bytes */${total}`);
      res.end();
      return;
    }
    throw err;
  }

  if (first.status === 200) {
    // Upstream ignored Range: pass the response through unchanged
    res.status(200);
    res.setHeader('Content-Type', mimeType || String(first.headers['content-type'] || 'audio/mp4'));
    if (first.headers['content-length']) {
      res.setHeader('Content-Length', String(first.headers['content-length']));
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-store');
    pipeline(first.data, res, () => {});
    return;
  }

  const finalEnd = reqEnd;
  const length = finalEnd - start + 1;

  res.status(range ? 206 : 200);
  res.setHeader('Content-Type', mimeType || String(first.headers['content-type'] || 'audio/mp4'));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Length', String(length));
  if (range) res.setHeader('Content-Range', `bytes ${start}-${finalEnd}/${total}`);

  if (req.method === 'HEAD') {
    first.data.destroy();
    res.end();
    return;
  }

  async function* body(): AsyncGenerator<Buffer> {
    let pos = start;
    let current: AxiosResponse<Readable> | null = first;
    while (pos <= finalEnd) {
      if (!current) {
        const chunkEnd = Math.min(pos + CHUNK_SIZE - 1, finalEnd);
        current = await fetchChunk(upstreamUrl, pos, chunkEnd, headers, signal);
      }
      for await (const piece of current.data) {
        const buf = piece as Buffer;
        const remaining = finalEnd - pos + 1;
        if (buf.length > remaining) {
          yield buf.subarray(0, remaining);
          pos += remaining;
          break;
        }
        yield buf;
        pos += buf.length;
      }
      current = null;
    }
  }

  pipeline(Readable.from(body()), res, (err: any) => {
    if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      console.error('[ChunkedProxy] Mid-stream pipeline error:', err.message);
    }
  });
}
