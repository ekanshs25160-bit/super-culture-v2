import { Innertube, UniversalCache } from 'youtubei.js';
import { LRUCache } from 'lru-cache';
import { TrackMeta, StreamEntry } from '../types/index.js';

let yt: Innertube;

export const initYouTube = async (): Promise<Innertube> => {
  if (!yt) {
    yt = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
      // CRITICAL: Force the client to YouTube Music to avoid standard YT 403 blocks
      client_type: 'WEB_REMIX' as any,
    });
    console.log('[YouTubeService] Innertube client initialized with WEB_REMIX.');
  }
  return yt;
};

export class YouTubeService {
  private streamCache: LRUCache<string, StreamEntry>;

  constructor() {
    // 4 hours TTL LRU cache matching PRD spec
    this.streamCache = new LRUCache<string, StreamEntry>({
      max: 500,
      ttl: 1000 * 60 * 60 * 4,
    });
  }

  /**
   * Lazy-initialize YouTube.js client
   */
  public async getClient(): Promise<Innertube> {
    return initYouTube();
  }

  /**
   * Enforces PRD high-fashion editorial 544x544 upscaled artwork
   */
  public upscaleThumbnail(url?: string): string {
    if (!url) return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop';
    return url.replace(/=w\d+-h\d+.*$/, '=w544-h544-l90-rj');
  }

  /**
   * Search tracks via YouTube Music
   */
  public async searchTracks(query: string, limit: number = 40): Promise<TrackMeta[]> {
    const client = await this.getClient();
    const results = await client.music.search(query, { type: 'song' });

    const rawItems: any[] = [...(results.songs?.contents || (results.contents?.[0] as any)?.contents || results.contents || [])];

    let currentContinuation: any = results;
    while (rawItems.length < limit && currentContinuation?.has_continuation && typeof currentContinuation.getContinuation === 'function') {
      try {
        const nextContinuation = await currentContinuation.getContinuation();
        const nextItems = nextContinuation.contents?.contents || nextContinuation.songs?.contents || nextContinuation.contents || [];
        if (!nextItems.length) break;
        rawItems.push(...nextItems);
        currentContinuation = nextContinuation;
      } catch (err) {
        console.warn('[YouTubeService] Error fetching search continuation:', err);
        break;
      }
    }

    const tracks: TrackMeta[] = [];
    for (const item of rawItems) {
      if (!item) continue;
      const song = item as any;
      const id = song.id || song.videoId;
      if (!id) continue;

      const rawThumb = song.thumbnails?.[0]?.url || song.thumbnail?.contents?.[0]?.url;
      tracks.push({
        videoId: id,
        title: song.title?.text || song.title || 'Unknown Title',
        artist: song.artists?.[0]?.name || song.author?.name || 'Unknown Artist',
        duration: song.duration?.seconds,
        durationFormatted: song.duration?.text,
        thumbnailUrl: this.upscaleThumbnail(rawThumb),
        album: song.album?.name,
      });

      if (tracks.length >= limit) break;
    }

    return tracks;
  }

  /**
   * Resolve audio stream URL with LRU caching
   */
  public async resolveAudioStream(videoId: string): Promise<StreamEntry> {
    const cached = this.streamCache.get(videoId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const client = await this.getClient();
    const info = await client.music.getInfo(videoId);

    const format = info.chooseFormat({
      type: 'audio',
      quality: 'best',
    });

    if (!format || !format.decipher(client.session.player)) {
      throw new Error(`Unable to decipher audio format for video ${videoId}`);
    }

    const streamUrl = format.decipher(client.session.player);
    const entry: StreamEntry = {
      videoId,
      url: streamUrl,
      mimeType: format.mime_type || 'audio/mp4',
      bitrate: format.bitrate,
      expiresAt: Date.now() + 1000 * 60 * 60 * 3.5, // 3.5 hours conservative expiration
    };

    this.streamCache.set(videoId, entry);
    return entry;
  }

  /**
   * Fetch Watch Next / Radio playlist for "PLAYING NEXT" pill
   */
  public async getUpNext(videoId: string): Promise<TrackMeta[]> {
    const client = await this.getClient();
    const upNext = await client.music.getUpNext(videoId);

    const tracks: TrackMeta[] = [];
    const contents = upNext.contents || [];

    for (const item of contents) {
      const song = item as any;
      if (!song.id || song.id === videoId) continue;

      const rawThumb = song.thumbnails?.[0]?.url;
      tracks.push({
        videoId: song.id,
        title: song.title?.text || song.title || 'Unknown Title',
        artist: song.artists?.[0]?.name || 'Unknown Artist',
        duration: song.duration?.seconds,
        durationFormatted: song.duration?.text,
        thumbnailUrl: this.upscaleThumbnail(rawThumb),
        album: song.album?.name,
      });
    }

    return tracks;
  }
}

export const ytService = new YouTubeService();
