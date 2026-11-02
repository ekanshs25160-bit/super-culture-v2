import { Innertube, UniversalCache } from 'youtubei.js';
import { LRUCache } from 'lru-cache';
import { TrackMeta, StreamEntry, ArtistMeta, SearchResultPayload } from '../types/index.js';

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
   * Search both artists and tracks in parallel via YouTube Music
   */
  public async search(query: string, limit: number = 40): Promise<SearchResultPayload> {
    const client = await this.getClient();

    const [songRes, artistRes] = await Promise.all([
      client.music.search(query, { type: 'song' }).catch(() => null),
      client.music.search(query, { type: 'artist' }).catch(() => null),
    ]);

    // Parse artists
    const rawArtists: any[] = [...(artistRes?.artists?.contents || (artistRes?.contents?.[0] as any)?.contents || artistRes?.contents || [])];
    const artists: ArtistMeta[] = [];
    for (const item of rawArtists) {
      if (!item) continue;
      const id = item.id || item.endpoint?.payload?.browseId;
      const name = item.name || item.title?.text || item.title;
      if (!name) continue;

      const rawThumb = item.thumbnails?.[0]?.url || item.thumbnail?.contents?.[0]?.url;
      const avatar = this.upscaleThumbnail(rawThumb);
      const subscribers = item.subscribers?.text || item.subscribers || '';

      artists.push({
        id: id || name,
        name: typeof name === 'string' ? name : String(name),
        subscribers: typeof subscribers === 'string' ? subscribers : '',
        avatar,
        role: subscribers || 'Artist',
      });
      if (artists.length >= 8) break;
    }

    // Parse tracks
    const rawItems: any[] = [...(songRes?.songs?.contents || (songRes?.contents?.[0] as any)?.contents || songRes?.contents || [])];

    let currentContinuation: any = songRes;
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
      const upscaled = this.upscaleThumbnail(rawThumb);
      tracks.push({
        id: id,
        videoId: id,
        title: song.title?.text || song.title || 'Unknown Title',
        artist: song.artists?.[0]?.name || song.author?.name || 'Unknown Artist',
        cover: upscaled,
        duration: song.duration?.seconds,
        durationFormatted: song.duration?.text || '3:30',
        thumbnailUrl: upscaled,
        album: song.album?.name,
      });

      if (tracks.length >= limit) break;
    }

    return { artists, tracks, results: tracks };
  }

  /**
   * Search tracks via YouTube Music (delegates to search)
   */
  public async searchTracks(query: string, limit: number = 40): Promise<TrackMeta[]> {
    const res = await this.search(query, limit);
    return res.tracks;
  }

  /**
   * Fetch an artist's official discography via YouTube Music artist lookup
   */
  public async getArtistDiscography(artistName: string, limit: number = 60): Promise<TrackMeta[]> {
    const client = await this.getClient();
    const searchResults: any = await client.music.search(artistName, { type: 'artist' });

    const artistList: any[] =
      searchResults.artists?.contents ||
      searchResults.artists ||
      searchResults.contents?.[0]?.contents ||
      [];

    const firstArtist = artistList[0];
    const artistId = firstArtist?.id;
    if (!artistId) {
      return [];
    }

    const artistProfile: any = await client.music.getArtist(artistId);
    const officialName = firstArtist?.name || artistName;

    const songsShelf =
      artistProfile.sections?.find((s: any) => s.type === 'MusicShelf') ||
      artistProfile.top_songs ||
      artistProfile.songs;

    let rawSongs: any[] = [];
    const browseId = songsShelf?.endpoint?.payload?.browseId;

    if (browseId) {
      try {
        const playlist: any = await client.music.getPlaylist(browseId);
        if (Array.isArray(playlist?.items) && playlist.items.length > 0) {
          rawSongs = playlist.items;
        }
      } catch (err) {
        console.warn('[YouTubeService] Could not expand artist songs playlist, using shelf contents:', err);
      }
    }

    if (rawSongs.length === 0) {
      rawSongs =
        songsShelf?.contents ||
        artistProfile.top_songs?.contents ||
        artistProfile.songs?.contents ||
        artistProfile.top_songs ||
        artistProfile.songs ||
        [];
    }

    const tracks: TrackMeta[] = [];
    for (const item of rawSongs) {
      if (!item) continue;
      const song = item as any;
      const id = song.id || song.videoId;
      if (!id) continue;

      const rawThumb = song.thumbnails?.[0]?.url || song.thumbnail?.contents?.[0]?.url;
      const upscaled = this.upscaleThumbnail(rawThumb);

      tracks.push({
        id,
        videoId: id,
        title: song.title?.text || song.title || 'Unknown Title',
        artist: song.artists?.[0]?.name || song.author?.name || officialName,
        cover: upscaled,
        duration: song.duration?.seconds,
        durationFormatted: song.duration?.text || '3:30',
        thumbnailUrl: upscaled,
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
export const getArtistDiscography = (artistName: string, limit?: number) =>
  ytService.getArtistDiscography(artistName, limit);
