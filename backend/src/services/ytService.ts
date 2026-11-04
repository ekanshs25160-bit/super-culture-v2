import './ytEval.js';
import { Innertube, UniversalCache, ClientType } from 'youtubei.js';
import { LRUCache } from 'lru-cache';
import { TrackMeta, StreamEntry, ArtistMeta, SearchResultPayload } from '../types/index.js';

let ytInstance: Innertube | null = null;
let ytInitPromise: Promise<Innertube> | null = null;

/**
 * Lazy singleton Innertube client with retry-on-failure refresh.
 * Guarantees a single instance is shared across all concurrent requests.
 */
export const getYtClient = async (retries = 3): Promise<Innertube> => {
  if (ytInstance) return ytInstance;
  if (ytInitPromise) return ytInitPromise;

  ytInitPromise = (async () => {
    let attempt = 0;
    while (attempt < retries) {
      try {
        attempt++;
        const client = await Innertube.create({
          cache: new UniversalCache(false),
          generate_session_locally: true,
          client_type: ClientType.IOS, // <-- Force IOS globally here
        });
        ytInstance = client;
        console.log('[ytService] Innertube client initialized.');
        return client;
      } catch (err: any) {
        console.warn(`[ytService] Innertube initialization attempt ${attempt}/${retries} failed:`, err.message || err);
        if (attempt >= retries) {
          ytInitPromise = null; // Reset promise so subsequent requests can retry
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
    ytInitPromise = null;
    throw new Error('Innertube failed to initialize after retries');
  })();

  return ytInitPromise;
};

export const refreshYtClient = async (): Promise<Innertube> => {
  ytInstance = null;
  ytInitPromise = null;
  return getYtClient();
};

// Helper to recursively extract MusicResponsiveListItem / Video / MusicShelf nodes from any youtubei.js response
export const extractItemsFromShelves = (node: any): any[] => {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(extractItemsFromShelves);
  if (Array.isArray(node.contents)) return node.contents.flatMap(extractItemsFromShelves);
  if (Array.isArray(node.items)) return node.items.flatMap(extractItemsFromShelves);
  if (Array.isArray(node.sections)) return node.sections.flatMap(extractItemsFromShelves);
  if (node.id || node.video_id || node.videoId || node.title || node.flex_columns) return [node];
  return [];
};

export const upscaleThumbnail = (url?: string): string => {
  if (!url) return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop';
  return url.replace(/=w\d+-h\d+.*$/, '=w544-h544-l90-rj');
};

export const normalizeTrackItem = (item: any): TrackMeta | null => {
  if (!item) return null;
  const videoId =
    item.id ||
    item.video_id ||
    item.videoId ||
    item.endpoint?.payload?.videoId ||
    item.on_tap?.payload?.videoId ||
    item.overlay?.content?.endpoint?.payload?.videoId;

  if (!videoId || typeof videoId !== 'string') return null;

  const title =
    typeof item.title === 'string'
      ? item.title
      : item.title?.text ||
        item.flex_columns?.[0]?.title?.text ||
        item.headline?.text ||
        'Unknown Title';

  const artist =
    item.artists?.[0]?.name ||
    item.author?.name ||
    (typeof item.author === 'string' ? item.author : null) ||
    item.subtitle?.runs?.[0]?.text ||
    item.flex_columns?.[1]?.title?.runs?.[0]?.text ||
    'Unknown Artist';

  const thumbnails =
    item.thumbnails ||
    item.thumbnail?.contents ||
    item.thumbnail ||
    [];
  const rawThumb = Array.isArray(thumbnails) && thumbnails.length > 0
    ? thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url
    : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const upscaled = upscaleThumbnail(rawThumb);

  const durationText =
    item.duration?.text ||
    item.length_text?.text ||
    (typeof item.duration === 'string' ? item.duration : '3:30');

  const durationSeconds =
    typeof item.duration?.seconds === 'number'
      ? item.duration.seconds
      : typeof item.duration === 'number'
      ? item.duration
      : 210;

  return {
    id: videoId,
    videoId,
    title: typeof title === 'string' ? title : String(title),
    artist: typeof artist === 'string' ? artist : String(artist),
    cover: upscaled,
    albumArt: upscaled,
    thumbnail_url: upscaled,
    thumbnailUrl: upscaled,
    duration: durationSeconds,
    durationFormatted: durationText,
    album: item.album?.name,
  };
};

export const searchMusicCatalog = async (query: string, limit = 40): Promise<SearchResultPayload> => {
  const yt = await getYtClient();
  const tracks: TrackMeta[] = [];
  const artists: ArtistMeta[] = [];
  const seenIds = new Set<string>();

  // Run song search and artist search in parallel using Promise.allSettled
  const [songResult, artistResult] = await Promise.allSettled([
    yt.music.search(query, { type: 'song' }),
    yt.music.search(query, { type: 'artist' }),
  ]);

  // 1. Process Song Results
  if (songResult.status === 'fulfilled' && songResult.value) {
    const rawSongs = [
      ...extractItemsFromShelves((songResult.value as any)?.songs),
      ...extractItemsFromShelves((songResult.value as any)?.contents),
    ];

    for (const item of rawSongs) {
      const normalized = normalizeTrackItem(item);
      if (normalized && !seenIds.has(normalized.videoId)) {
        seenIds.add(normalized.videoId);
        tracks.push(normalized);
      }
    }
  }

  // Fallback to standard YouTube search if YT Music returned 0 tracks
  if (tracks.length === 0) {
    try {
      const stdSearch: any = await yt.search(query, { type: 'video' });
      const rawVideos = stdSearch?.videos || stdSearch?.results || extractItemsFromShelves(stdSearch);

      for (const item of rawVideos) {
        const normalized = normalizeTrackItem(item);
        if (normalized && !seenIds.has(normalized.videoId)) {
          seenIds.add(normalized.videoId);
          tracks.push(normalized);
        }
      }
    } catch (fallbackErr: any) {
      console.warn('[ytService] Standard YouTube search fallback failed, trying general music search:', fallbackErr.message);
      try {
        const generalMusic: any = await yt.music.search(query);
        const rawGeneral = extractItemsFromShelves(generalMusic);
        for (const item of rawGeneral) {
          const normalized = normalizeTrackItem(item);
          if (normalized && !seenIds.has(normalized.videoId)) {
            seenIds.add(normalized.videoId);
            tracks.push(normalized);
          }
        }
      } catch (genErr: any) {
        console.error('[ytService] All search attempts failed:', genErr.message);
      }
    }
  }

  // 2. Process Artist Results
  if (artistResult.status === 'fulfilled' && artistResult.value) {
    const rawArtists = [
      ...extractItemsFromShelves((artistResult.value as any)?.artists),
      ...extractItemsFromShelves((artistResult.value as any)?.contents),
    ];

    const seenArtists = new Set<string>();
    for (const item of rawArtists) {
      const name =
        typeof item.name === 'string'
          ? item.name
          : item.title?.text || item.flex_columns?.[0]?.title?.text;
      if (!name || seenArtists.has(name.toLowerCase())) continue;

      const thumbs = item.thumbnails || item.thumbnail?.contents || item.thumbnail || [];
      const rawThumb = Array.isArray(thumbs) && thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : null;
      const avatar = upscaleThumbnail(rawThumb);

      seenArtists.add(name.toLowerCase());
      artists.push({
        id: item.id || item.endpoint?.payload?.browseId || name,
        name,
        avatar: avatar || tracks[0]?.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
        role: item.subscribers?.text || 'Artist',
      });
      if (artists.length >= 8) break;
    }
  }

  // Derive unique artists from tracks if artist search returns empty
  if (artists.length === 0 && tracks.length > 0) {
    const seen = new Set<string>();
    for (const t of tracks) {
      const cleanName = t.artist?.split(/[,&]|feat\.|ft\./i)[0]?.trim();
      if (cleanName && !seen.has(cleanName.toLowerCase())) {
        seen.add(cleanName.toLowerCase());
        artists.push({
          id: cleanName,
          name: cleanName,
          avatar: t.cover || '',
          role: 'Artist',
        });
      }
      if (artists.length >= 8) break;
    }
  }

  const slicedTracks = tracks.slice(0, limit);
  return {
    tracks: slicedTracks,
    artists: artists.slice(0, 8),
    results: slicedTracks,
  };
};

export class YouTubeService {
  public streamCache: LRUCache<string, StreamEntry>;

  constructor() {
    this.streamCache = new LRUCache<string, StreamEntry>({
      max: 500,
      ttl: 1000 * 60 * 60 * 4,
    });
  }

  public async getClient(): Promise<Innertube> {
    return getYtClient();
  }

  public upscaleThumbnail(url?: string): string {
    return upscaleThumbnail(url);
  }

  public async search(query: string, limit = 40): Promise<SearchResultPayload> {
    return searchMusicCatalog(query, limit);
  }

  public async searchTracks(query: string, limit = 40): Promise<TrackMeta[]> {
    const res = await searchMusicCatalog(query, limit);
    return res.tracks;
  }

  public async getArtistDiscography(artistName: string, limit = 60): Promise<TrackMeta[]> {
    const yt = await getYtClient();
    let tracks: TrackMeta[] = [];
    const seenIds = new Set<string>();

    try {
      // Parallelize artist lookup and fallback song search
      const [artistSearchResult, directSongsResult] = await Promise.allSettled([
        yt.music.search(artistName, { type: 'artist' }),
        yt.music.search(`${artistName} official audio`, { type: 'song' }),
      ]);

      if (artistSearchResult.status === 'fulfilled' && artistSearchResult.value) {
        const rawArtists = [
          ...extractItemsFromShelves((artistSearchResult.value as any)?.artists),
          ...extractItemsFromShelves((artistSearchResult.value as any)?.contents),
        ];
        const artistId = rawArtists[0]?.id || rawArtists[0]?.endpoint?.payload?.browseId;

        if (artistId) {
          const artistProfile: any = await yt.music.getArtist(artistId);
          const songsShelf =
            artistProfile.sections?.find((s: any) => s.type === 'MusicShelf') ||
            artistProfile.top_songs ||
            artistProfile.songs;

          let rawSongs: any[] = [];
          const browseId = songsShelf?.endpoint?.payload?.browseId;
          if (browseId) {
            try {
              const playlist: any = await yt.music.getPlaylist(browseId);
              if (Array.isArray(playlist?.items) && playlist.items.length > 0) {
                rawSongs = playlist.items;
              }
            } catch {
              // Fallback to shelf contents
            }
          }

          if (rawSongs.length === 0) {
            rawSongs = extractItemsFromShelves(songsShelf || artistProfile);
          }

          for (const item of rawSongs) {
            const normalized = normalizeTrackItem(item);
            if (normalized && !seenIds.has(normalized.videoId)) {
              seenIds.add(normalized.videoId);
              tracks.push(normalized);
            }
            if (tracks.length >= limit) break;
          }
        }
      }

      // Merge direct song search if tracks is still low
      if (tracks.length < 5 && directSongsResult.status === 'fulfilled' && directSongsResult.value) {
        const rawDirect = extractItemsFromShelves(directSongsResult.value);
        for (const item of rawDirect) {
          const normalized = normalizeTrackItem(item);
          if (normalized && !seenIds.has(normalized.videoId)) {
            seenIds.add(normalized.videoId);
            tracks.push(normalized);
          }
          if (tracks.length >= limit) break;
        }
      }
    } catch (profileErr: any) {
      console.warn('[ytService] getArtist profile lookup failed:', profileErr.message || profileErr);
    }

    // Fallback if yt.music.getArtist() returned fewer than 5 tracks
    if (tracks.length < 5) {
      try {
        const fallbackRes = await searchMusicCatalog(`${artistName} official audio`, limit);
        const nameLower = artistName.toLowerCase();
        for (const t of fallbackRes.tracks) {
          if (!seenIds.has(t.videoId)) {
            seenIds.add(t.videoId);
            if (t.artist.toLowerCase().includes(nameLower) || tracks.length < 5) {
              tracks.push(t);
            }
          }
          if (tracks.length >= limit) break;
        }
      } catch (fallbackErr: any) {
        console.error('[ytService] Artist discography fallback search failed:', fallbackErr.message);
      }
    }

    return tracks;
  }

  public async resolveAudioStream(videoId: string, prefer?: 'aac' | 'best'): Promise<StreamEntry> {
    const cacheKey = `${videoId}:${prefer || 'best'}`;
    const cached = this.streamCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const client = await this.getClient();
    let info: any;
    try {
      info = await client.getBasicInfo(videoId, { client: 'VISIONOS' });
    } catch {
      try {
        info = await client.getBasicInfo(videoId, { client: 'IOS' });
      } catch {
        try {
          info = await client.music.getInfo(videoId);
        } catch {
          info = await client.getInfo(videoId);
        }
      }
    }

    let format: any;
    if (prefer === 'aac') {
      try {
        format = info.chooseFormat({
          type: 'audio',
          quality: 'best',
          format: 'mp4',
        });
      } catch {
        // Fallback to searching adaptive formats
      }

      if (!format || !(format.mime_type?.includes('mp4a') || format.mime_type?.includes('audio/mp4'))) {
        const audioFormats = (info.streaming_data?.adaptive_formats || []).filter(
          (f: any) =>
            f.has_audio &&
            (f.mime_type?.includes('audio/mp4') || f.mime_type?.includes('mp4a'))
        );
        if (audioFormats.length > 0) {
          audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
          format = audioFormats[0];
        }
      }
    }

    if (!format) {
      format = info.chooseFormat({
        type: 'audio',
        quality: 'best',
      });
    }

    if (!format) {
      throw new Error(`No compatible audio format found for video ${videoId}`);
    }

    let streamUrl = format.url;
    if (!streamUrl && typeof format.decipher === 'function') {
      try {
        streamUrl = await format.decipher(client.session.player);
      } catch (decErr: any) {
        console.warn(`[ytService] format.decipher failed for ${videoId}:`, decErr.message || decErr);
      }
    }

    if (!streamUrl) {
      throw new Error(`Unable to decipher audio format for video ${videoId}`);
    }

    const entry: StreamEntry = {
      videoId,
      url: streamUrl,
      mimeType: format.mime_type || 'audio/mp4',
      bitrate: format.bitrate,
      expiresAt: Date.now() + 1000 * 60 * 60 * 3.5,
    };

    this.streamCache.set(cacheKey, entry);
    return entry;
  }

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
        thumbnailUrl: upscaleThumbnail(rawThumb),
        album: song.album?.name,
      });
    }

    return tracks;
  }
}

export const ytService = new YouTubeService();
export const getArtistDiscography = (artistName: string, limit?: number) =>
  ytService.getArtistDiscography(artistName, limit);
