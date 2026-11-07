import axios, { AxiosResponse } from 'axios';
import type { Request, Response } from 'express';
import { Readable, pipeline } from 'node:stream';

/**
 * Googlevideo URLs reject open-ended ("bytes=0-") and large Range requests with HTTP 403,
 * but accept small bounded ranges. Browsers' <audio> element sends open-ended ranges, so we
 * translate every browser request into sequential bounded upstream requests and stitch the
 * results into ONE response. Seeking, Safari's probe requests and plain GETs all work.
 */
export const CHUNK_SIZE = 1024 * 1024; // 1 MB per upstream request

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
  const range = parseRange(req.headers.range);

  let start = 0;
  let reqEnd: number | null = null;
  let total: number | null = null;

  if (range && range.start === null) {
    // suffix range "bytes=-N": learn the total size first
    const probe = await fetchChunk(upstreamUrl, 0, 0, headers, signal);
    total = parseTotal(probe.headers['content-range']);
    probe.data.destroy();
    if (total == null) throw new Error('Unable to determine content length');
    start = Math.max(0, total - (range.end as number));
    reqEnd = total - 1;
  } else if (range) {
    start = range.start as number;
    reqEnd = range.end;
  }

  const firstEnd =
    reqEnd !== null ? Math.min(reqEnd, start + CHUNK_SIZE - 1) : start + CHUNK_SIZE - 1;

  let first: AxiosResponse<Readable>;
  try {
    first = await fetchChunk(upstreamUrl, start, firstEnd, headers, signal);
  } catch (err: any) {
    if (err?.response?.status === 416) {
      err.response.data?.destroy?.();
      res.status(416).setHeader('Content-Range', `bytes */${total ?? '*'}`);
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

  total = total ?? parseTotal(first.headers['content-range']);
  if (total == null) {
    first.data.destroy();
    throw new Error('Upstream did not report total size');
  }

  if (start > total - 1) {
    first.data.destroy();
    res.status(416).setHeader('Content-Range', `bytes */${total}`);
    res.end();
    return;
  }

  const finalEnd = reqEnd !== null ? Math.min(reqEnd, total - 1) : total - 1;
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

  pipeline(Readable.from(body()), res, () => {
    /* client aborts and upstream errors end the response; nothing else to do */
  });
}
