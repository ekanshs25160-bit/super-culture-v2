import { Request, Response } from 'express';
import axios from 'axios';
import { ytService, getArtistDiscography, getClientUserAgent } from '../services/ytService.js';
import { serveChunked } from '../services/chunkedProxy.js';
import { cacheService, CacheService } from '../services/cacheService.js';
import { createStreamToken, verifyStreamToken } from '../services/tokenService.js';
import { TrackMeta, StreamEntry } from '../types/index.js';

export const SELFTEST_VIDEO_ID = 'dQw4w9WgXcQ';

export class MusicController {
  /**
   * Search songs and music tracks (Cached 5 min, SWR)
   * GET /api/music/search?q={query}
   */
  public async search(req: Request, res: Response): Promise<void> {
    try {
      const q = req.query.q as string;
      const limit = Number(req.query.limit) || 40;
      if (!q || !q.trim()) {
        res.status(400).json({ error: 'Search query parameter "q" is required' });
        return;
      }

      const normalizedQ = cacheService.normalizeQuery(q);
      const cacheKey = `search:${normalizedQ}:${limit}`;

      const { data, cached, stale } = await cacheService.getOrFetch(
        cacheKey,
        CacheService.TTL.SEARCH,
        () => ytService.search(q, limit)
      );

      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      res.setHeader('X-Cache', cached ? (stale ? 'STALE' : 'HIT') : 'MISS');

      res.json({
        status: 'success',
        data: data.tracks,
        tracks: data.tracks,
        artists: data.artists,
      });
    } catch (error: any) {
      console.error('[MusicController] Search error:', error.message || error);
      res.status(500).json({ error: 'Failed to search tracks', details: error.message });
    }
  }

  /**
   * Fetch artist official discography (Cached 30 min, SWR)
   * GET /api/music/artist/:name
   */
  public async getArtist(req: Request, res: Response): Promise<void> {
    try {
      const rawName = decodeURIComponent(req.params.name || '').trim();
      if (!rawName) {
        res.status(400).json({ error: 'Artist name parameter is required' });
        return;
      }

      const normalizedName = cacheService.normalizeQuery(rawName);
      const cacheKey = `artist:${normalizedName}:60`;

      const { data, cached, stale } = await cacheService.getOrFetch(
        cacheKey,
        CacheService.TTL.ARTIST,
        async () => {
          const tracks = await getArtistDiscography(rawName);
          const artistInfo = {
            name: rawName,
            avatar: tracks[0]?.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
          };
          return { tracks, artist: artistInfo };
        }
      );

      res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600');
      res.setHeader('X-Cache', cached ? (stale ? 'STALE' : 'HIT') : 'MISS');

      res.json({
        status: 'success',
        data: data.tracks,
        tracks: data.tracks,
        artist: data.artist,
      });
    } catch (error: any) {
      console.error('[MusicController] getArtist error:', error.message || error);
      res.status(500).json({ error: 'Failed to fetch artist discography', details: error.message });
    }
  }

  /**
   * Issue signed stream URL with 5-minute HMAC token
   * POST /api/music/stream-url
   */
  public async getStreamUrl(req: Request, res: Response): Promise<void> {
    try {
      const { videoId, prefer } = req.body || {};
      if (!videoId || typeof videoId !== 'string') {
        res.status(400).json({ error: 'videoId string is required' });
        return;
      }

      const token = createStreamToken(videoId);
      const preferParam = prefer === 'aac' ? '&prefer=aac' : '';
      const url = `/api/yt/stream/${videoId}?t=${encodeURIComponent(token)}${preferParam}`;

      const streamInfo = await ytService.resolveAudioStream(
        videoId,
        prefer === 'aac' ? 'aac' : 'best'
      );

      if (streamInfo.throttled || streamInfo.code === 'STREAM_LIMITED') {
        res.json({
          url,
          throttled: true,
          code: 'STREAM_LIMITED',
          reason: streamInfo.reason || 'Stream throttled by YouTube • Compatibility mode (YouTube)',
        });
        return;
      }

      res.json({
        url,
        throttled: false,
      });
    } catch (err: any) {
      console.error('[MusicController] stream-url generation error:', err.message);
      res.status(500).json({ error: 'Failed to generate signed stream URL', details: err.message });
    }
  }

  /**
   * Stream audio proxy supporting byte-range headers (206 Partial Content), HEAD, and HMAC token validation
   * GET /api/yt/stream/:videoId
   * HEAD /api/yt/stream/:videoId
   */
  public async stream(req: Request, res: Response): Promise<void> {
    const { videoId } = req.params;
    const token = req.query.t as string | undefined;
    const prefer = req.query.prefer === 'aac' ? 'aac' : 'best';

    if (!videoId) {
      res.status(400).json({ error: 'videoId parameter is required' });
      return;
    }

    // Verify HMAC token
    const tokenStatus = verifyStreamToken(videoId, token);
    if (!tokenStatus.valid) {
      res.status(403).json({ error: 'Invalid or missing stream token' });
      return;
    }
    if (tokenStatus.expired) {
      res.status(410).json({ error: 'Stream token expired' });
      return;
    }

    const abortController = new AbortController();
    req.on('close', () => {
      abortController.abort();
    });

    let streamInfo: StreamEntry;

    try {
      streamInfo = await ytService.resolveAudioStream(videoId, prefer);
      await serveChunked(req, res, streamInfo.url, {
        mimeType: streamInfo.mimeType,
        headers: {
          'User-Agent': getClientUserAgent(streamInfo.client),
        },
        signal: abortController.signal,
      });
    } catch (initialErr: any) {
      if (axios.isCancel(initialErr) || abortController.signal.aborted) {
        return;
      }
      if (res.headersSent) {
        console.warn(
          `[MusicController] Error after headers sent for ${videoId}:`,
          initialErr.message || initialErr
        );
        ytService.invalidateStreamCache(videoId);
        return;
      }

      console.warn(
        `[MusicController] Initial upstream stream failed for ${videoId} (${initialErr.message || initialErr}). Retrying once with fresh stream resolution...`
      );
      ytService.invalidateStreamCache(videoId);

      try {
        streamInfo = await ytService.resolveAudioStream(videoId, prefer);
        await serveChunked(req, res, streamInfo.url, {
          mimeType: streamInfo.mimeType,
          headers: {
            'User-Agent': getClientUserAgent(streamInfo.client),
          },
          signal: abortController.signal,
        });
      } catch (retryErr: any) {
        if (axios.isCancel(retryErr) || abortController.signal.aborted) {
          return;
        }
        console.error(
          `[MusicController] Stream resolution retry failed for ${videoId}:`,
          retryErr.message || retryErr
        );
        if (!res.headersSent) {
          res.status(502).json({
            code: 'STREAM_UNAVAILABLE',
            message: 'Unable to resolve audio stream for this track',
          });
        }
        return;
      }
    }
  }

  /**
   * Diagnostic self-test endpoint to verify YouTube audio stream resolving and upstream accessibility.
   * GET /api/yt/selftest
   */
  public async selfTest(_req: Request, res: Response): Promise<void> {
    try {
      const streamInfo = await ytService.resolveAudioStream(SELFTEST_VIDEO_ID, 'aac');
      const upstreamRes = await axios.get(streamInfo.url, {
        headers: {
          Range: 'bytes=0-1',
          'User-Agent': getClientUserAgent(streamInfo.client),
        },
        responseType: 'stream',
        validateStatus: () => true,
        timeout: 10000,
      });

      if (upstreamRes.data && typeof upstreamRes.data.destroy === 'function') {
        upstreamRes.data.destroy();
      }

      if (upstreamRes.status === 200 || upstreamRes.status === 206) {
        res.json({ ok: true, status: upstreamRes.status });
      } else {
        res.status(502).json({ ok: false, error: `Upstream HTTP ${upstreamRes.status}` });
      }
    } catch (err: any) {
      console.error('[MusicController] selfTest error:', err.message || err);
      res.status(502).json({ ok: false, error: err.message || 'Stream self-test failed' });
    }
  }

  /**
   * Up next / Watch playlist recommendations (Cached 30 min, SWR)
   * GET /api/yt/up-next/:videoId
   */
  public async getUpNext(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      if (!videoId) {
        res.status(400).json({ error: 'videoId parameter is required' });
        return;
      }

      const cacheKey = `up-next:${videoId}`;
      const { data, cached, stale } = await cacheService.getOrFetch(
        cacheKey,
        CacheService.TTL.UP_NEXT,
        () => ytService.getUpNext(videoId)
      );

      res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600');
      res.setHeader('X-Cache', cached ? (stale ? 'STALE' : 'HIT') : 'MISS');

      res.json({ tracks: data });
    } catch (error: any) {
      console.error('[MusicController] UpNext error:', error.message || error);
      res.status(500).json({ error: 'Failed to load up-next playlist', details: error.message });
    }
  }

  /**
   * Generates the home shelves payload (Curated stacks & trending highlights)
   */
  public async generateHomeShelves(): Promise<{ shelves: any[] }> {
    const trending: TrackMeta[] = [
      {
        videoId: 'IlEkvbRmfrA',
        title: 'Archangel',
        artist: 'Burial',
        duration: 238,
        durationFormatted: '3:58',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
      },
      {
        videoId: 'r4l9bFqgMaQ',
        title: 'Nights',
        artist: 'Frank Ocean',
        duration: 307,
        durationFormatted: '5:07',
        thumbnailUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=544&h=544&fit=crop',
      },
      {
        videoId: 'UBS4Gi1y_nc',
        title: 'Windowlicker',
        artist: 'Aphex Twin',
        duration: 367,
        durationFormatted: '6:07',
        thumbnailUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=544&h=544&fit=crop',
      },
      {
        videoId: 'JQpKtnLUduE',
        title: 'Cherry-coloured',
        artist: 'Cocteau Twins',
        duration: 192,
        durationFormatted: '3:12',
        thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
      },
    ];

    const chillVibes: TrackMeta[] = [
      {
        videoId: 'TCd6PfxOy0Y',
        title: 'Chill Vibes Mix • Track 01',
        artist: 'Brian Eno, Floating Points',
        duration: 280,
        durationFormatted: '4:40',
        thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=544&h=544&fit=crop',
      },
      {
        videoId: 'FvOpPeKSf_4',
        title: 'Glimpse of Us',
        artist: 'Joji',
        duration: 233,
        durationFormatted: '3:53',
        thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
      },
      {
        videoId: 'MV_3Dpw-BRY',
        title: 'Nightcall (Ambient Mix)',
        artist: 'Kavinsky',
        duration: 252,
        durationFormatted: '4:12',
        thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
      },
    ];

    const hipHop: TrackMeta[] = [
      {
        videoId: 'hI8A14Qcv68',
        title: 'N.Y. State of Mind',
        artist: 'Nas, DJ Premier',
        duration: 294,
        durationFormatted: '4:54',
        thumbnailUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=544&h=544&fit=crop',
      },
      {
        videoId: 'sw4c17Z4N4I',
        title: 'N95',
        artist: 'Kendrick Lamar',
        duration: 215,
        durationFormatted: '3:35',
        thumbnailUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=544&h=544&fit=crop',
      },
      {
        videoId: 'r4l9bFqgMaQ',
        title: 'First Person Shooter',
        artist: 'Drake ft. J. Cole',
        duration: 247,
        durationFormatted: '4:07',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
      },
    ];

    const lateNight: TrackMeta[] = [
      {
        videoId: 'MV_3Dpw-BRY',
        title: 'Nightcall (Runway Edit)',
        artist: 'Kavinsky, Lovefoxxx',
        duration: 252,
        durationFormatted: '4:12',
        thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
      },
      {
        videoId: 'O1OTWCd40bc',
        title: 'Wicked Games',
        artist: 'The Weeknd',
        duration: 325,
        durationFormatted: '5:25',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
      },
      {
        videoId: 'TCd6PfxOy0Y',
        title: 'Veridis Quo',
        artist: 'Daft Punk',
        duration: 345,
        durationFormatted: '5:45',
        thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=544&h=544&fit=crop',
      },
    ];

    const madeForYou: TrackMeta = {
      videoId: '2tOutF8B3f8',
      title: 'Daily Mix 01 • Xtal',
      artist: 'Aphex Twin, Blood Orange, Tirzah',
      duration: 291,
      durationFormatted: '4:51',
      thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=544&h=544&fit=crop',
    };

    return {
      shelves: [
        {
          id: 'trending_worldwide',
          title: 'Trending Worldwide',
          type: 'trending',
          items: trending,
        },
        {
          id: 'chill_vibes',
          title: 'Chill Vibes',
          type: 'curated_stack',
          items: chillVibes,
        },
        {
          id: 'hip_hop_essentials',
          title: 'Hip Hop Essentials',
          type: 'curated_stack',
          items: hipHop,
        },
        {
          id: 'late_night_drive',
          title: 'Late Night Drive',
          type: 'curated_stack',
          items: lateNight,
        },
        {
          id: 'made_for_you',
          title: 'Made for you',
          type: 'highlight',
          items: [madeForYou],
        },
      ],
    };
  }

  /**
   * Warm home shelves cache and schedule periodic 15-minute background refresh
   */
  public async warmHomeShelvesCache(): Promise<void> {
    try {
      const data = await this.generateHomeShelves();
      cacheService.set('home-shelves', data, CacheService.TTL.HOME_SHELVES);
      console.log('[MusicController] Home shelves cache pre-warmed.');
    } catch (err: any) {
      console.warn('[MusicController] Failed to pre-warm home shelves cache:', err.message);
    }
  }

  /**
   * Home shelves endpoint (Cached 15 min, SWR)
   * GET /api/music/home-shelves or /api/yt/home-shelves
   */
  public async getHomeShelves(req: Request, res: Response): Promise<void> {
    try {
      const cacheKey = 'home-shelves';
      const { data, cached, stale } = await cacheService.getOrFetch(
        cacheKey,
        CacheService.TTL.HOME_SHELVES,
        () => this.generateHomeShelves()
      );

      res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=1800');
      res.setHeader('X-Cache', cached ? (stale ? 'STALE' : 'HIT') : 'MISS');

      res.json(data);
    } catch (error: any) {
      console.error('[MusicController] Home shelves error:', error.message || error);
      res.status(500).json({ error: 'Failed to load home shelves' });
    }
  }

  /**
   * Search music catalog with LRU cache & SWR deduplication
   */
  public async searchMusicCatalogCached(query: string, limit = 1): Promise<TrackMeta | null> {
    const normalizedQ = cacheService.normalizeQuery(query);
    const cacheKey = `search:${normalizedQ}:${limit}`;

    const { data } = await cacheService.getOrFetch(
      cacheKey,
      CacheService.TTL.SEARCH,
      () => ytService.search(query, limit)
    );

    return data?.tracks?.[0] || null;
  }

  /**
   * Import playlist tracklist from plain text list (Max 20 per request)
   * POST /api/music/import
   */
  public async importTracklist(req: Request, res: Response): Promise<void> {
    try {
      const { tracklist } = req.body || {};
      if (!Array.isArray(tracklist)) {
        res.status(400).json({ error: 'tracklist array of strings is required' });
        return;
      }

      // Filter and limit to 20 tracks to prevent request timeouts
      const queries = tracklist
        .filter((t: any) => typeof t === 'string' && t.trim().length > 0)
        .map((t: string) => t.trim())
        .slice(0, 20);

      if (queries.length === 0) {
        res.json({
          status: 'success',
          tracks: [],
          matchedCount: 0,
          totalRequested: 0,
        });
        return;
      }

      const lookups = queries.map(async (query: string) => {
        try {
          return await this.searchMusicCatalogCached(query, 1);
        } catch (err: any) {
          console.warn(`[MusicController] import track match failed for "${query}":`, err.message || err);
          return null;
        }
      });

      const results = await Promise.all(lookups);
      const seenIds = new Set<string>();
      const matchedTracks: TrackMeta[] = [];

      for (const track of results) {
        if (track && track.videoId && !seenIds.has(track.videoId)) {
          seenIds.add(track.videoId);
          matchedTracks.push(track);
        }
      }

      res.json({
        status: 'success',
        tracks: matchedTracks,
        matchedCount: matchedTracks.length,
        totalRequested: queries.length,
      });
    } catch (error: any) {
      console.error('[MusicController] importTracklist error:', error.message || error);
      res.status(500).json({ error: 'Failed to import tracklist', details: error.message });
    }
  }
}

export const musicController = new MusicController();
export const getArtist = (req: Request, res: Response) => musicController.getArtist(req, res);
export const searchMusicCatalogCached = (query: string, limit = 1) => musicController.searchMusicCatalogCached(query, limit);
