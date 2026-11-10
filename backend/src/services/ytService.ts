import './ytEval.js';
import { Innertube, UniversalCache, ClientType } from 'youtubei.js';
import { LRUCache } from 'lru-cache';
import { TrackMeta, StreamEntry, ArtistMeta, SearchResultPayload } from '../types/index.js';

export const DEFAULT_CLIENT_ORDER = ['VISIONOS', 'IOS', 'MWEB', 'MUSIC'] as const;

export const VISIONOS_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';

export const getClientOrder = (): string[] => {
  const envOrder = process.env.YT_CLIENT_ORDER;
  if (envOrder && envOrder.trim().length > 0) {
    return envOrder
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }
  return [...DEFAULT_CLIENT_ORDER];
};

export const getClientUserAgent = (clientName?: string): string => {
  switch (clientName) {
    case 'VISIONOS':
      return VISIONOS_USER_AGENT;
    case 'IOS':
      return 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)';
    case 'ANDROID':
      return 'com.google.android.youtube/19.44.38 (Linux; U; Android 14; en_US; Pixel 8 Pro Build/UQ1A.240205.004)';
    case 'MWEB':
      return 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    case 'MUSIC':
      return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    default:
      return 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)';
  }
};

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

  public invalidateStreamCache(videoId: string): void {
    this.streamCache.delete(`${videoId}:aac`);
    this.streamCache.delete(`${videoId}:best`);
    this.streamCache.delete(videoId);
  }

  private pickFormat(info: any, prefer?: 'aac' | 'best'): any {
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
      try {
        format = info.chooseFormat({
          type: 'audio',
          quality: 'best',
        });
      } catch {
        // Fallback to choosing any audio adaptive format
      }
    }

    if (!format) {
      const audioFormats = (info.streaming_data?.adaptive_formats || []).filter(
        (f: any) => f.has_audio
      );
      if (audioFormats.length > 0) {
        audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
        format = audioFormats[0];
      }
    }

    return format;
  }

  public async probeStreamUrl(
    url: string,
    clientName: string
  ): Promise<{ ok: boolean; throttled: boolean }> {
    try {
      const userAgent = getClientUserAgent(clientName);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          Range: 'bytes=0-1',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status !== 200 && res.status !== 206) {
        return { ok: false, throttled: false };
      }

      try {
        await res.arrayBuffer();
      } catch {}

      const contentRange = res.headers.get('content-range') || '';
      const match = contentRange.match(/\/(\d+)$/);
      const contentLengthHeader = res.headers.get('content-length');
      const total = match
        ? parseInt(match[1], 10)
        : contentLengthHeader
        ? parseInt(contentLengthHeader, 10)
        : 0;

      if (total > 1_100_000) {
        const probes: Array<{ start: number; end: number }> = [
          { start: total - 64, end: total - 1 },
        ];
        if (total > 2_097_152) {
          probes.push({ start: 1572864, end: 1572900 });
        }

        for (const { start, end } of probes) {
          const expectedLength = end - start + 1;
          const deepController = new AbortController();
          const deepTimeout = setTimeout(() => deepController.abort(), 4000);
          try {
            const deepRes = await fetch(url, {
              method: 'GET',
              headers: {
                'User-Agent': userAgent,
                Range: `bytes=${start}-${end}`,
              },
              signal: deepController.signal,
            });
            clearTimeout(deepTimeout);

            let bodyLen = 0;
            try {
              const buf = await deepRes.arrayBuffer();
              bodyLen = buf.byteLength;
            } catch {}

            if (deepRes.status === 206) {
              continue;
            }
            const clHeader = deepRes.headers.get('content-length');
            const reportedLen = clHeader ? parseInt(clHeader, 10) : bodyLen;
            if (deepRes.status === 200 && (reportedLen === expectedLength || bodyLen === expectedLength)) {
              continue;
            }
            return { ok: true, throttled: true };
          } catch (_deepErr) {
            clearTimeout(deepTimeout);
            return { ok: true, throttled: true };
          }
        }
      }

      return { ok: true, throttled: false };
    } catch (probeErr: any) {
      console.warn(`[ytService] probe exception for ${clientName}:`, probeErr.message || probeErr);
      return { ok: false, throttled: false };
    }
  }

  private watchPageCache: { visitorData: string; sts: number; expiresAt: number } | null = null;
  private watchPageInflight: Promise<{ visitorData: string; sts: number }> | null = null;

  public async getWatchPageContext(
    videoId: string,
    forceRefresh = false
  ): Promise<{ visitorData: string; sts: number }> {
    if (!forceRefresh && this.watchPageCache && this.watchPageCache.expiresAt > Date.now()) {
      return { visitorData: this.watchPageCache.visitorData, sts: this.watchPageCache.sts };
    }
    if (!forceRefresh && this.watchPageInflight) {
      return this.watchPageInflight;
    }

    const task = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(
          `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&bpctr=9999999999&has_verified=1`,
          {
            method: 'GET',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);
        const html = await res.text();
        const vdMatch = html.match(/"VISITOR_DATA":"([^"]+)"/) || html.match(/"visitorData":"([^"]+)"/);
        const stsMatch = html.match(/"STS":(\d+)/);
        const visitorData = vdMatch ? vdMatch[1] : '';
        const sts = stsMatch ? parseInt(stsMatch[1], 10) : 20760;

        if (visitorData) {
          this.watchPageCache = {
            visitorData,
            sts,
            expiresAt: Date.now() + 1000 * 60 * 30, // 30 minutes TTL
          };
        }
        return { visitorData, sts };
      } finally {
        clearTimeout(timeout);
        this.watchPageInflight = null;
      }
    })();

    this.watchPageInflight = task;
    return task;
  }

  public async fetchVisionOsInfo(videoId: string): Promise<any> {
    const callPlayer = async (visitorData: string, sts: number) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-YouTube-Client-Name': '101',
            'X-YouTube-Client-Version': '1.02',
            Origin: 'https://www.youtube.com',
            'User-Agent': VISIONOS_USER_AGENT,
            ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'VISIONOS',
                clientVersion: '1.02',
                deviceMake: 'Apple',
                deviceModel: 'RealityDevice17,1',
                userAgent: VISIONOS_USER_AGENT,
                osName: 'visionOS',
                osVersion: '26.5.23O471',
                hl: 'en',
                timeZone: 'UTC',
                utcOffsetMinutes: 0,
              },
            },
            videoId,
            playbackContext: {
              contentPlaybackContext: {
                html5Preference: 'HTML5_PREF_WANTS',
                signatureTimestamp: sts,
              },
            },
            contentCheckOk: true,
            racyCheckOk: true,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return (await res.json()) as any;
      } finally {
        clearTimeout(timeout);
      }
    };

    let ctx = await this.getWatchPageContext(videoId, false);
    let data = await callPlayer(ctx.visitorData, ctx.sts);

    if (data?.playabilityStatus?.status !== 'OK' || !data?.streamingData) {
      ctx = await this.getWatchPageContext(videoId, true);
      data = await callPlayer(ctx.visitorData, ctx.sts);
    }

    const rawAdaptive = [
      ...(data?.streamingData?.adaptiveFormats || []),
      ...(data?.streamingData?.formats || []),
    ];

    const normalizedFormats = rawAdaptive.map((f: any) => ({
      itag: f.itag,
      url: f.url,
      mime_type: f.mimeType || '',
      bitrate: f.bitrate || f.averageBitrate || 0,
      content_length: f.contentLength ? parseInt(String(f.contentLength), 10) : undefined,
      has_audio: Boolean((f.mimeType && f.mimeType.startsWith('audio/')) || f.audioQuality),
    }));

    return {
      playability_status: {
        status: data?.playabilityStatus?.status,
        reason: data?.playabilityStatus?.reason,
      },
      streaming_data: normalizedFormats.length > 0 ? { adaptive_formats: normalizedFormats } : null,
    };
  }

  public async resolveAudioStream(videoId: string, prefer?: 'aac' | 'best'): Promise<StreamEntry> {
    const cacheKey = `${videoId}:${prefer || 'best'}`;
    const cached = this.streamCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    let client: Innertube | null = null;
    let fallbackThrottledEntry: StreamEntry | null = null;
    const clientOrder = getClientOrder();

    for (const name of clientOrder) {
      try {
        let info: any;
        if (name === 'VISIONOS') {
          info = await this.fetchVisionOsInfo(videoId);
        } else {
          if (!client) {
            client = await this.getClient();
          }
          info = name === 'MUSIC'
            ? await client.music.getInfo(videoId)
            : await client.getBasicInfo(videoId, { client: name as any });
        }

        if (!info.streaming_data) {
          console.warn(`[ytService] ${videoId}: ${name} gave no formats (${info.playability_status?.status}: ${info.playability_status?.reason ?? ''})`);
          continue;
        }

        const format = this.pickFormat(info, prefer);
        if (!format) {
          console.warn(`[ytService] ${videoId}: ${name} had no compatible audio formats`);
          continue;
        }

        const url =
          format.url ??
          (typeof format.decipher === 'function' && client
            ? await format.decipher(client.session.player)
            : undefined);

        if (!url) {
          continue;
        }

        const probe = await this.probeStreamUrl(url, name);
        if (!probe.ok) {
          console.warn(`[ytService] ${videoId}: ${name} stream probe failed or returned non-200/206 status`);
          continue;
        }

        const entry: StreamEntry = {
          videoId,
          url,
          client: name,
          mimeType: format.mime_type || (prefer === 'aac' ? 'audio/mp4; codecs="mp4a.40.2"' : 'audio/mp4'),
          bitrate: format.bitrate,
          expiresAt: Date.now() + 1000 * 60 * 60 * 3.5,
          throttled: probe.throttled,
        };

        if (!probe.throttled) {
          this.streamCache.set(cacheKey, entry);
          return entry;
        }

        if (!fallbackThrottledEntry) {
          fallbackThrottledEntry = entry;
        }
      } catch (e: any) {
        console.warn(`[ytService] ${videoId}: ${name} failed: ${e.message}`);
      }
    }

    if (fallbackThrottledEntry) {
      const negativeTtlMs = 1000 * 60 * 30; // 30 minutes negative cache
      const limitedEntry: StreamEntry = {
        ...fallbackThrottledEntry,
        throttled: true,
        code: 'STREAM_LIMITED',
        reason: 'Stream throttled by YouTube • Compatibility mode (YouTube)',
        expiresAt: Date.now() + negativeTtlMs,
      };
      this.streamCache.set(cacheKey, limitedEntry, { ttl: negativeTtlMs });
      return limitedEntry;
    }

    throw new Error('No client returned a playable stream');
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
