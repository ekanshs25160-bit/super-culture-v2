import { Innertube, UniversalCache } from 'youtubei.js';
import { LRUCache } from 'lru-cache';
import { TrackMeta, StreamEntry, ArtistMeta, SearchResultPayload } from '../types/index.js';

let ytInstance: Innertube | null = null;

export const getYtClient = async (): Promise<Innertube> => {
  if (!ytInstance) {
    ytInstance = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
    });
    console.log('[ytService] Innertube client initialized.');
  }
  return ytInstance;
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

  // 1. Try YouTube Music Song Search first
  try {
    const songSearch: any = await yt.music.search(query, { type: 'song' });
    const rawSongs = [
      ...extractItemsFromShelves(songSearch?.songs),
      ...extractItemsFromShelves(songSearch?.contents),
    ];

    for (const item of rawSongs) {
      const normalized = normalizeTrackItem(item);
      if (normalized && !seenIds.has(normalized.videoId)) {
        seenIds.add(normalized.videoId);
        tracks.push(normalized);
      }
    }
  } catch (err) {
    console.warn('[ytService] yt.music song search failed, falling back to yt.search:', err);
  }

  // 2. Fallback to standard YouTube search if YT Music returned 0 tracks (common on Render IPs)
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
    } catch (fallbackErr) {
      console.warn('[ytService] Standard YouTube search fallback failed, trying general music search:', fallbackErr);
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
      } catch (genErr) {
        console.error('[ytService] All search attempts failed:', genErr);
      }
    }
  }

  // 3. Extract matching Artists
  try {
    const artistSearch: any = await yt.music.search(query, { type: 'artist' });
    const rawArtists = [
      ...extractItemsFromShelves(artistSearch?.artists),
      ...extractItemsFromShelves(artistSearch?.contents),
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
  } catch (artistErr) {
    console.warn('[ytService] Artist search failed:', artistErr);
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
  private streamCache: LRUCache<string, StreamEntry>;

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
      const searchResults: any = await yt.music.search(artistName, { type: 'artist' });
      const rawArtists = [
        ...extractItemsFromShelves(searchResults?.artists),
        ...extractItemsFromShelves(searchResults?.contents),
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
            // Use shelf contents if playlist expansion fails
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
    } catch (profileErr) {
      console.warn('[ytService] getArtist profile lookup failed:', profileErr);
    }

    // Fallback if yt.music.getArtist() fails or returns fewer than 5 tracks
    if (tracks.length < 5) {
      try {
        const fallbackRes = await searchMusicCatalog(`${artistName} official audio`, limit);
        const nameLower = artistName.toLowerCase();
        for (const t of fallbackRes.tracks) {
          if (!seenIds.has(t.videoId)) {
            seenIds.add(t.videoId);
            // Prioritize tracks matching artist name, or append
            if (t.artist.toLowerCase().includes(nameLower) || tracks.length < 5) {
              tracks.push(t);
            }
          }
          if (tracks.length >= limit) break;
        }
      } catch (fallbackErr) {
        console.error('[ytService] Artist discography fallback search failed:', fallbackErr);
      }
    }

    return tracks;
  }

  public async resolveAudioStream(videoId: string): Promise<StreamEntry> {
    const cached = this.streamCache.get(videoId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const client = await this.getClient();
    let info: any;
    try {
      info = await client.music.getInfo(videoId);
    } catch {
      info = await client.getInfo(videoId);
    }

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
      expiresAt: Date.now() + 1000 * 60 * 60 * 3.5,
    };

    this.streamCache.set(videoId, entry);
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
