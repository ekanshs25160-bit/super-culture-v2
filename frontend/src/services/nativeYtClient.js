import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';

export const VISIONOS_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';

export const StreamProxy = registerPlugin('StreamProxy');

// In-memory cache for watch-page visitorData & sts (1 hour TTL)
let watchPageCache = {
  visitorData: '',
  sts: 20760,
  expiresAt: 0,
};
let watchPageInflight = null;

// Test seam overrides
let testProxyPort = null;
let testPlayerResponse = null;
let testWatchPageContext = null;

export function setNativeProxyPortForTesting(port) {
  testProxyPort = port;
}

export function setMockPlayerResponseForTesting(mock) {
  testPlayerResponse = mock;
}

export function setMockWatchPageForTesting(mock) {
  testWatchPageContext = mock;
}

/**
 * Upscales YouTube thumbnail URLs to high quality.
 */
export function upscaleThumbnail(url) {
  if (!url) return '';
  return url
    .replace(/=w\d+-h\d+.*$/, '=w544-h544-l90-rj')
    .replace(/=s\d+.*$/, '=s544')
    .replace(/\/default\.jpg$/, '/maxresdefault.jpg')
    .replace(/\/hqdefault\.jpg$/, '/maxresdefault.jpg');
}

/**
 * Helper to execute HTTP GET using CapacitorHttp when native or fetch otherwise.
 */
async function httpGet(url, headers = {}) {
  if (Capacitor.isNativePlatform()) {
    return CapacitorHttp.get({ url, headers });
  }
  const res = await fetch(url, { headers });
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Keep as raw text
  }
  return {
    data,
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
  };
}

/**
 * Helper to execute HTTP POST using CapacitorHttp when native or fetch otherwise.
 */
async function httpPost(url, headers = {}, body = {}) {
  if (Capacitor.isNativePlatform()) {
    return CapacitorHttp.post({ url, headers, data: body });
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Keep as raw text
  }
  return {
    data,
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
  };
}

/**
 * Retrieves visitorData and STS signature timestamp from YouTube watch page.
 * Cached in-memory for 1 hour.
 */
export async function getWatchPageVisitorData(videoId, forceRefresh = false) {
  if (testWatchPageContext) {
    return typeof testWatchPageContext === 'function'
      ? testWatchPageContext(videoId)
      : testWatchPageContext;
  }

  const now = Date.now();
  if (!forceRefresh && watchPageCache.visitorData && watchPageCache.expiresAt > now) {
    return { visitorData: watchPageCache.visitorData, sts: watchPageCache.sts };
  }

  if (!forceRefresh && watchPageInflight) {
    return watchPageInflight;
  }

  watchPageInflight = (async () => {
    try {
      const targetUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&bpctr=9999999999&has_verified=1`;
      const res = await httpGet(targetUrl, {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      });

      const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || '');
      const vdMatch = html.match(/"VISITOR_DATA":"([^"]+)"/) || html.match(/"visitorData":"([^"]+)"/);
      const stsMatch = html.match(/"STS":(\d+)/);

      const visitorData = vdMatch ? vdMatch[1] : '';
      const sts = stsMatch ? parseInt(stsMatch[1], 10) : 20760;

      if (visitorData) {
        watchPageCache = {
          visitorData,
          sts,
          expiresAt: now + 60 * 60 * 1000, // 1 hour TTL
        };
      }
      return { visitorData, sts };
    } catch (err) {
      console.warn('[nativeYtClient] Failed to fetch watch page context:', err.message || err);
      return { visitorData: watchPageCache.visitorData || '', sts: watchPageCache.sts || 20760 };
    } finally {
      watchPageInflight = null;
    }
  })();

  return watchPageInflight;
}

/**
 * Queries the Android LocalStreamProxy plugin for its local loopback port.
 */
export async function getLocalProxyPort() {
  if (testProxyPort !== null) return testProxyPort;
  try {
    const res = await StreamProxy.getProxyPort();
    return res?.port || 0;
  } catch (err) {
    console.warn('[nativeYtClient] Could not get StreamProxy port:', err.message || err);
    return 0;
  }
}

/**
 * Resolves an unthrottled audio stream URL on-device using YouTube's VISIONOS client.
 */
export async function resolveNativeStreamUrl(videoId, prefer = 'aac') {
  if (testPlayerResponse) {
    const mock = typeof testPlayerResponse === 'function' ? testPlayerResponse(videoId) : testPlayerResponse;
    return mock;
  }

  // 1. Get visitorData & STS context
  let ctx = await getWatchPageVisitorData(videoId, false);

  const callPlayer = async (visitorData, sts) => {
    const headers = {
      'Content-Type': 'application/json',
      'X-YouTube-Client-Name': '101',
      'X-YouTube-Client-Version': '1.02',
      Origin: 'https://www.youtube.com',
      'User-Agent': VISIONOS_USER_AGENT,
      ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
    };

    const body = {
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
    };

    const res = await httpPost('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', headers, body);
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  };

  let data = await callPlayer(ctx.visitorData, ctx.sts);

  if (data?.playabilityStatus?.status !== 'OK' || !data?.streamingData) {
    ctx = await getWatchPageVisitorData(videoId, true);
    data = await callPlayer(ctx.visitorData, ctx.sts);
  }

  if (!data?.streamingData) {
    throw new Error(`[nativeYtClient] Playback failed for ${videoId}: ${data?.playabilityStatus?.reason || 'No streaming data'}`);
  }

  // 2. Pick format
  const rawAdaptive = [
    ...(data.streamingData.adaptiveFormats || []),
    ...(data.streamingData.formats || []),
  ];

  const audioFormats = rawAdaptive.filter(
    (f) =>
      Boolean(f.url) &&
      (f.hasAudio !== false) &&
      (String(f.mimeType || '').startsWith('audio/') || Boolean(f.audioQuality) || Boolean(f.audioSampleRate))
  );

  if (audioFormats.length === 0) {
    throw new Error(`[nativeYtClient] No playable audio format found for ${videoId}`);
  }

  let chosen = null;
  if (prefer === 'aac') {
    const mp4Formats = audioFormats.filter(
      (f) =>
        String(f.mimeType || '').includes('audio/mp4') ||
        String(f.mimeType || '').includes('mp4a') ||
        f.itag === 140
    );
    if (mp4Formats.length > 0) {
      mp4Formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      chosen = mp4Formats[0];
    }
  }

  if (!chosen) {
    audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    chosen = audioFormats[0];
  }

  if (!chosen?.url) {
    throw new Error(`[nativeYtClient] Unable to find unthrottled direct URL for ${videoId}`);
  }

  // 3. 1.5 MiB Deep Probe verification (bytes=1572864-1572900)
  try {
    const probeRes = await httpGet(chosen.url, {
      'User-Agent': VISIONOS_USER_AGENT,
      Range: 'bytes=1572864-1572900',
    });
    if (probeRes.status === 403) {
      console.warn(`[nativeYtClient] 1.5 MiB deep probe returned 403 for ${videoId}`);
    }
  } catch (probeErr) {
    console.warn(`[nativeYtClient] Deep probe warning for ${videoId}:`, probeErr.message || probeErr);
  }

  // 4. Construct proxy loopback URL for Android
  let finalUrl = chosen.url;
  const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  if (isAndroid) {
    const port = await getLocalProxyPort();
    if (port > 0) {
      finalUrl = `http://127.0.0.1:${port}/stream?url=${encodeURIComponent(chosen.url)}&ua=${encodeURIComponent(VISIONOS_USER_AGENT)}`;
    }
  }

  return {
    url: finalUrl,
    directUrl: chosen.url,
    videoId,
    mimeType: chosen.mimeType || 'audio/mp4',
    bitrate: chosen.bitrate || 128000,
    throttled: false,
    isNative: true,
    expiresIn: 12600,
  };
}

/**
 * Native Innertube singleton for client-side search, artist and up-next catalog lookups.
 */
let nativeInnertubePromise = null;
async function getNativeInnertube() {
  if (!nativeInnertubePromise) {
    nativeInnertubePromise = (async () => {
      try {
        const { Innertube, UniversalCache } = await import('youtubei.js/web');
        return await Innertube.create({
          cache: new UniversalCache(false),
          generate_session_locally: true,
        });
      } catch (err) {
        console.warn('[nativeYtClient] Failed to initialize Innertube/web:', err.message || err);
        return null;
      }
    })();
  }
  return nativeInnertubePromise;
}

function normalizeTrackItem(item) {
  if (!item) return null;
  const videoId = item.id || item.videoId || item.endpoint?.payload?.videoId;
  if (!videoId || typeof videoId !== 'string') return null;

  const title =
    item.title?.text ||
    (typeof item.title === 'string' ? item.title : '') ||
    'Unknown Title';

  let artist = 'Unknown Artist';
  if (item.artists && Array.isArray(item.artists) && item.artists.length > 0) {
    artist = item.artists.map((a) => a.name || a.text).filter(Boolean).join(', ');
  } else if (item.author) {
    artist = typeof item.author === 'string' ? item.author : item.author.name || item.author.text || artist;
  } else if (item.subtitle?.text) {
    artist = item.subtitle.text;
  }

  let durationSeconds = 0;
  let durationText = '3:30';
  if (item.duration) {
    durationSeconds = item.duration.seconds || item.duration;
    durationText = item.duration.text || durationText;
  }

  const thumbs = item.thumbnails || item.thumbnail?.contents || item.thumbnail || [];
  const rawThumb = Array.isArray(thumbs) && thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : null;
  const upscaled = upscaleThumbnail(rawThumb || '');

  return {
    id: videoId,
    videoId,
    title: String(title),
    artist: String(artist),
    cover: upscaled,
    albumArt: upscaled,
    thumbnail_url: upscaled,
    thumbnailUrl: upscaled,
    duration: typeof durationSeconds === 'number' ? durationSeconds : 210,
    durationFormatted: String(durationText),
    album: item.album?.name,
  };
}

function extractItems(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (Array.isArray(source.contents)) return source.contents;
  if (Array.isArray(source.items)) return source.items;
  return [];
}

/**
 * Native Search implementation
 */
export async function search(query, limit = 40) {
  const tracks = [];
  const artists = [];
  const seenIds = new Set();

  try {
    const yt = await getNativeInnertube();
    if (yt) {
      const [songRes, artistRes] = await Promise.allSettled([
        yt.music.search(query, { type: 'song' }),
        yt.music.search(query, { type: 'artist' }),
      ]);

      if (songRes.status === 'fulfilled' && songRes.value) {
        const rawSongs = [
          ...extractItems(songRes.value?.songs),
          ...extractItems(songRes.value?.contents),
        ];
        for (const item of rawSongs) {
          const norm = normalizeTrackItem(item);
          if (norm && !seenIds.has(norm.videoId)) {
            seenIds.add(norm.videoId);
            tracks.push(norm);
          }
        }
      }

      if (artistRes.status === 'fulfilled' && artistRes.value) {
        const rawArtists = [
          ...extractItems(artistRes.value?.artists),
          ...extractItems(artistRes.value?.contents),
        ];
        const seenNames = new Set();
        for (const a of rawArtists) {
          const name = a.name || a.title?.text;
          if (name && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            const thumbs = a.thumbnails || a.thumbnail?.contents || [];
            const rawThumb = Array.isArray(thumbs) && thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : '';
            artists.push({
              id: a.id || name,
              name,
              avatar: upscaleThumbnail(rawThumb),
              role: 'Artist',
            });
            if (artists.length >= 8) break;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[nativeYtClient] Music search exception:', err.message || err);
  }

  // Fallback to trending catalog if empty
  if (tracks.length === 0) {
    const defaultShelves = getCuratedHomeShelves();
    for (const shelf of defaultShelves.shelves) {
      for (const item of shelf.items) {
        if (!seenIds.has(item.videoId) && (item.title.toLowerCase().includes(query.toLowerCase()) || item.artist.toLowerCase().includes(query.toLowerCase()))) {
          seenIds.add(item.videoId);
          tracks.push(item);
        }
      }
    }
  }

  const slicedTracks = tracks.slice(0, limit);
  return {
    tracks: slicedTracks,
    artists: artists.slice(0, 8),
    results: slicedTracks,
  };
}

/**
 * Curated offline & standalone home shelves
 */
export function getCuratedHomeShelves() {
  const trending = [
    {
      videoId: '2tOutF8B3f8',
      title: 'Daily Mix 01 • Xtal',
      artist: 'Aphex Twin, Blood Orange, Tirzah',
      duration: 291,
      durationFormatted: '4:51',
      thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=544&h=544&fit=crop',
    },
    {
      videoId: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      duration: 213,
      durationFormatted: '3:33',
      thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
    },
    {
      videoId: 'sw4c17Z4N4I',
      title: 'N95',
      artist: 'Kendrick Lamar',
      duration: 195,
      durationFormatted: '3:15',
      thumbnailUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=544&h=544&fit=crop',
    },
  ];

  const chillVibes = [
    {
      videoId: 'TCd6PfxOy0Y',
      title: 'Veridis Quo',
      artist: 'Daft Punk',
      duration: 345,
      durationFormatted: '5:45',
      thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=544&h=544&fit=crop',
    },
    {
      videoId: 'FvOpPeKSf_4',
      title: 'Glimpse of Us',
      artist: 'Joji',
      duration: 233,
      durationFormatted: '3:53',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
    },
    {
      videoId: 'MV_3Dpw-BRY',
      title: 'Nightcall (Ambient Mix)',
      artist: 'Kavinsky',
      duration: 252,
      durationFormatted: '4:12',
      thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
    },
  ];

  const hipHop = [
    {
      videoId: 'hI8A14Qcv68',
      title: 'N.Y. State of Mind',
      artist: 'Nas, DJ Premier',
      duration: 294,
      durationFormatted: '4:54',
      thumbnailUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=544&h=544&fit=crop',
    },
    {
      videoId: 'r4l9bFqgMaQ',
      title: 'First Person Shooter',
      artist: 'Drake ft. J. Cole',
      duration: 247,
      durationFormatted: '4:07',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
    },
  ];

  const lateNight = [
    {
      videoId: 'MV_3Dpw-BRY',
      title: 'Nightcall (Runway Edit)',
      artist: 'Kavinsky, Lovefoxxx',
      duration: 252,
      durationFormatted: '4:12',
      thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
    },
    {
      videoId: 'O1OTWCd40bc',
      title: 'Wicked Games',
      artist: 'The Weeknd',
      duration: 325,
      durationFormatted: '5:25',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
    },
  ];

  const madeForYou = {
    videoId: '2tOutF8B3f8',
    title: 'Daily Mix 01 • Xtal',
    artist: 'Aphex Twin, Blood Orange, Tirzah',
    duration: 291,
    durationFormatted: '4:51',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=544&h=544&fit=crop',
    cover: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=544&h=544&fit=crop',
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

export async function getHomeShelves() {
  return getCuratedHomeShelves();
}

/**
 * Native Artist lookup
 */
export async function getArtist(name) {
  const res = await search(name, 20);
  return {
    artist: {
      id: name,
      name,
      avatar: res.tracks[0]?.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
    },
    tracks: res.tracks,
  };
}

/**
 * Native Up Next lookup
 */
export async function getUpNext(videoId) {
  try {
    const yt = await getNativeInnertube();
    if (yt) {
      const upNext = await yt.music.getUpNext(videoId);
      const contents = upNext?.contents || [];
      const tracks = [];
      for (const item of contents) {
        const norm = normalizeTrackItem(item);
        if (norm && norm.videoId !== videoId) {
          tracks.push(norm);
        }
      }
      if (tracks.length > 0) return tracks;
    }
  } catch (err) {
    console.warn('[nativeYtClient] getUpNext exception:', err.message || err);
  }

  // Fallback: return remaining curated tracks
  const defaultShelves = getCuratedHomeShelves();
  const allTracks = defaultShelves.shelves.flatMap((s) => s.items);
  return allTracks.filter((t) => t.videoId !== videoId);
}

/**
 * Native Import Tracklist
 */
export async function importTracklist(tracklist) {
  if (!Array.isArray(tracklist)) return [];
  const results = [];
  for (const query of tracklist.slice(0, 20)) {
    const res = await search(query, 1);
    if (res.tracks.length > 0) {
      results.push(res.tracks[0]);
    }
  }
  return results;
}

export default {
  resolveNativeStreamUrl,
  getWatchPageVisitorData,
  getLocalProxyPort,
  search,
  getHomeShelves,
  getArtist,
  getUpNext,
  importTracklist,
  upscaleThumbnail,
};
