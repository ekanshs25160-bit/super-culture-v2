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
      });
    } catch (error: any) {
      console.error('[MusicController] Home shelves error:', error);
      res.status(500).json({ error: 'Failed to load home shelves' });
    }
  }
}

export const musicController = new MusicController();
