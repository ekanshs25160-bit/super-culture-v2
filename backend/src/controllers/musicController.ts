import { Request, Response } from 'express';
import axios from 'axios';
import { ytService } from '../services/ytService.js';
import { TrackMeta } from '../types/index.js';

export class MusicController {
  /**
   * Search songs and music tracks
   * GET /api/yt/search?q={query}
   */
  public async search(req: Request, res: Response): Promise<void> {
    try {
      const q = req.query.q as string;
      const limit = Number(req.query.limit) || 40;
      if (!q || !q.trim()) {
        res.status(400).json({ error: 'Search query parameter "q" is required' });
        return;
      }

      const results = await ytService.searchTracks(q, limit);
      res.json(results);
    } catch (error: any) {
      console.error('[MusicController] Search error:', error);
      res.status(500).json({ error: 'Failed to search tracks', details: error.message });
    }
  }

  /**
   * Stream audio proxy supporting byte-range headers (206 Partial Content)
   * GET /api/yt/stream/:videoId
   */
  public async stream(req: Request, res: Response): Promise<void> {
    const { videoId } = req.params;
    try {
      if (!videoId) {
        res.status(400).json({ error: 'videoId parameter is required' });
        return;
      }

      const streamInfo = await ytService.resolveAudioStream(videoId);
      const range = req.headers.range;

      const response = await axios.get(streamInfo.url, {
        headers: range ? { Range: range } : undefined,
        responseType: 'stream',
        validateStatus: (status) => status >= 200 && status < 400,
      });

      res.status(response.status);
      res.setHeader('Content-Type', streamInfo.mimeType || 'audio/mp4');
      res.setHeader('Accept-Ranges', 'bytes');

      if (response.headers['content-range']) {
        res.setHeader('Content-Range', String(response.headers['content-range']));
      }
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', String(response.headers['content-length']));
      }

      response.data.pipe(res);
    } catch (error: any) {
      console.error(`[MusicController] Stream error for ${videoId}:`, error.message);
      res.status(500).json({ error: 'Failed to stream audio', details: error.message });
    }
  }

  /**
   * Up next / Watch playlist recommendations for "PLAYING NEXT" pill
   * GET /api/yt/up-next/:videoId
   */
  public async getUpNext(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      const tracks = await ytService.getUpNext(videoId);
      res.json({ tracks });
    } catch (error: any) {
      console.error('[MusicController] UpNext error:', error);
      res.status(500).json({ error: 'Failed to load up-next playlist', details: error.message });
    }
  }

  /**
   * Pre-warmed home shelves (Trending Worldwide, Curated stacks)
   * GET /api/yt/home-shelves
   */
  public async getHomeShelves(req: Request, res: Response): Promise<void> {
    try {
      // Return curated editorial starter data with high-res album covers
      const trending: TrackMeta[] = [
        {
          videoId: 'kJQP7kiw5Fk',
          title: 'Despacito',
          artist: 'Luis Fonsi ft. Daddy Yankee',
          duration: 230,
          durationFormatted: '3:50',
          thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
        },
        {
          videoId: 'fJ9rUzIMcZQ',
          title: 'Bohemian Rhapsody',
          artist: 'Queen',
          duration: 354,
          durationFormatted: '5:54',
          thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=544&h=544&fit=crop',
        },
        {
          videoId: 'JGwWNGJdvx8',
          title: 'Shape of You',
          artist: 'Ed Sheeran',
          duration: 233,
          durationFormatted: '3:53',
          thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
        },
      ];

      res.json({
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
            items: trending,
          },
        ],
      });
    } catch (error: any) {
      console.error('[MusicController] Home shelves error:', error);
      res.status(500).json({ error: 'Failed to load home shelves' });
    }
  }
}

export const musicController = new MusicController();
