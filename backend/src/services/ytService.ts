import { Innertube, UniversalCache } from 'youtubei.js';
import { LRUCache } from 'lru-cache';
import { TrackMeta, StreamEntry } from '../types/index.js';

export class YouTubeService {
  private yt: Innertube | null = null;
  private streamCache: LRUCache<string, StreamEntry>;
  private isInitializing = false;

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
    if (this.yt) return this.yt;

    if (!this.isInitializing) {
      this.isInitializing = true;
      try {
        this.yt = await Innertube.create({
          cache: new UniversalCache(false),
          generate_session_locally: true,
        });
        console.log('[YouTubeService] Innertube client initialized.');
      } finally {
        this.isInitializing = false;
      }
    } else {
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    if (!this.yt) {
      throw new Error('Failed to initialize YouTube client');
    }

    return this.yt;
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
  public async searchTracks(query: string): Promise<TrackMeta[]> {
    const yt = await this.getClient();
    const results = await yt.music.search(query, { type: 'song' });

    const tracks: TrackMeta[] = [];
    const contents = results.contents || [];

    for (const item of contents) {
      // Extract track metadata safely from Innertube response
      const song = item as any;
      if (!song.id) continue;

      const rawThumb = song.thumbnails?.[0]?.url || song.thumbnail?.contents?.[0]?.url;
      tracks.push({
        videoId: song.id,
        title: song.title?.text || song.title || 'Unknown Title',
        artist: song.artists?.[0]?.name || song.author?.name || 'Unknown Artist',
        duration: song.duration?.seconds,
        durationFormatted: song.duration?.text,
        thumbnailUrl: this.upscaleThumbnail(rawThumb),
        album: song.album?.name,
      });
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

    const yt = await this.getClient();
    const info = await yt.music.getInfo(videoId);

    const format = info.chooseFormat({
      type: 'audio',
      quality: 'best',
    });

    if (!format || !format.decipher(yt.session.player)) {
      throw new Error(`Unable to decipher audio format for video ${videoId}`);
    }

    const streamUrl = format.decipher(yt.session.player);
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
    const yt = await this.getClient();
    const upNext = await yt.music.getUpNext(videoId);

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
