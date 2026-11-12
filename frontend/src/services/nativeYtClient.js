import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';

export const VISIONOS_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';

export const IOS_USER_AGENT =
  'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)';

export const MWEB_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

export const YTM_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export const StreamProxy = registerPlugin('StreamProxy');

const YTM_CONTEXT = {
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20240724.01.00',
    hl: 'en',
    gl: 'US',
  },
};

const YTM_HEADERS = {
  'Content-Type': 'application/json',
  Origin: 'https://music.youtube.com',
  Referer: 'https://music.youtube.com/',
  'User-Agent': YTM_USER_AGENT,
};

// In-memory cache for watch-page visitorData & sts (1 hour TTL)
let watchPageCache = {
  visitorData: '',
  sts: 20760,
  expiresAt: 0,
};
let watchPageInflight = null;

// Test seam overrides
let testProxyPort = null;
let testProxySecret = null;
let proxySecret = '';
let testPlayerResponse = null;
let testWatchPageContext = null;

export function setNativeProxyPortForTesting(port, secret = null) {
  testProxyPort = port;
  if (secret !== null) {
    testProxySecret = secret;
    proxySecret = secret;
  }
}

export function setNativeProxySecretForTesting(secret) {
  testProxySecret = secret;
  proxySecret = secret || '';
}

export function getProxySecret() {
  return proxySecret;
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

function parseDurationSeconds(str) {
  if (typeof str === 'number') return str;
  if (!str || typeof str !== 'string') return 210;
  const parts = str.trim().split(':').map((n) => parseInt(n, 10));
  if (parts.some((n) => Number.isNaN(n))) return 210;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 210;
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
 * Queries the Android StreamProxyPlugin for its local loopback base URL / port.
 */
export async function getLocalProxyUrl() {
  if (testProxyPort !== null) {
    if (testProxySecret !== null) {
      proxySecret = testProxySecret;
    }
    return testProxyPort > 0 ? `http://127.0.0.1:${testProxyPort}` : '';
  }
  try {
    if (typeof StreamProxy.getProxyUrl === 'function') {
      const res = await StreamProxy.getProxyUrl();
      if (res?.secret) proxySecret = res.secret;
      if (res?.baseUrl) return res.baseUrl.replace(/\/$/, '');
      if (res?.port > 0) return `http://127.0.0.1:${res.port}`;
    }
    if (typeof StreamProxy.getProxyPort === 'function') {
      const res = await StreamProxy.getProxyPort();
      if (res?.secret) proxySecret = res.secret;
      if (res?.baseUrl) return res.baseUrl.replace(/\/$/, '');
      if (res?.port > 0) return `http://127.0.0.1:${res.port}`;
    }
    return '';
  } catch (err) {
    console.warn('[nativeYtClient] Could not get StreamProxy URL:', err.message || err);
    return '';
  }
}

export async function getLocalProxyPort() {
  if (testProxyPort !== null) return testProxyPort;
  const baseUrl = await getLocalProxyUrl();
  const match = baseUrl.match(/:(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function buildPlayerPayload(clientName, videoId, sts) {
  if (clientName === 'IOS') {
    return {
      headers: {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': '5',
        'X-YouTube-Client-Version': '19.45.4',
        Origin: 'https://www.youtube.com',
        'User-Agent': IOS_USER_AGENT,
      },
      userAgent: IOS_USER_AGENT,
      body: {
        context: {
          client: {
            clientName: 'IOS',
            clientVersion: '19.45.4',
            deviceMake: 'Apple',
            deviceModel: 'iPhone16,2',
            userAgent: IOS_USER_AGENT,
            osName: 'iPhone',
            osVersion: '18.1.0.22B83',
            hl: 'en',
            gl: 'US',
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
      },
    };
  }

  if (clientName === 'MWEB') {
    return {
      headers: {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': '2',
        'X-YouTube-Client-Version': '2.20240726.00.00',
        Origin: 'https://m.youtube.com',
        'User-Agent': MWEB_USER_AGENT,
      },
      userAgent: MWEB_USER_AGENT,
      body: {
        context: {
          client: {
            clientName: 'MWEB',
            clientVersion: '2.20240726.00.00',
            userAgent: MWEB_USER_AGENT,
            hl: 'en',
            gl: 'US',
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
      },
    };
  }

  // Default: VISIONOS
  return {
    headers: {
      'Content-Type': 'application/json',
      'X-YouTube-Client-Name': '101',
      'X-YouTube-Client-Version': '1.02',
      Origin: 'https://www.youtube.com',
      'User-Agent': VISIONOS_USER_AGENT,
    },
    userAgent: VISIONOS_USER_AGENT,
    body: {
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
          gl: 'US',
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
    },
  };
}

function selectBestAudioFormat(streamingData, prefer = 'aac') {
  const rawAdaptive = [
    ...(streamingData?.adaptiveFormats || []),
    ...(streamingData?.formats || []),
  ];

  const audioFormats = rawAdaptive.filter(
    (f) =>
      Boolean(f.url) &&
      f.hasAudio !== false &&
      (String(f.mimeType || '').startsWith('audio/') || Boolean(f.audioQuality) || Boolean(f.audioSampleRate))
  );

  if (audioFormats.length === 0) return null;

  if (prefer === 'aac') {
    const mp4Formats = audioFormats.filter(
      (f) =>
        String(f.mimeType || '').includes('audio/mp4') ||
        String(f.mimeType || '').includes('mp4a') ||
        f.itag === 140
    );
    if (mp4Formats.length > 0) {
      mp4Formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      return mp4Formats[0];
    }
  }

  audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  return audioFormats[0];
}

async function wrapWithLocalProxy(upstreamUrl, userAgent) {
  const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  if (isAndroid) {
    const baseUrl = await getLocalProxyUrl();
    if (baseUrl) {
      const tokenParam = proxySecret ? `&k=${encodeURIComponent(proxySecret)}` : '';
      return `${baseUrl}/stream?url=${encodeURIComponent(upstreamUrl)}&ua=${encodeURIComponent(userAgent)}${tokenParam}`;
    }
  }
  return upstreamUrl;
}

/**
 * Resolves an audio stream URL on-device using YouTube's VISIONOS client (with IOS / MWEB fallback).
 * Verifies with a 1.5 MiB deep probe (`Range: bytes=1572864-1572900`).
 */
export async function resolveAudioStream(videoId, prefer = 'aac') {
  if (testPlayerResponse) {
    return typeof testPlayerResponse === 'function' ? testPlayerResponse(videoId) : testPlayerResponse;
  }

  let ctx = await getWatchPageVisitorData(videoId, false);
  const clientOrder = ['VISIONOS', 'IOS', 'MWEB'];
  let fallbackThrottledCandidate = null;

  for (const clientName of clientOrder) {
    try {
      const callClient = async (visitorData, sts) => {
        const spec = buildPlayerPayload(clientName, videoId, sts);
        const headers = {
          ...spec.headers,
          ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
        };
        const res = await httpPost(
          'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
          headers,
          spec.body
        );
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        return { data, userAgent: spec.userAgent };
      };

      let { data, userAgent } = await callClient(ctx.visitorData, ctx.sts);

      if (clientName === 'VISIONOS' && (data?.playabilityStatus?.status !== 'OK' || !data?.streamingData)) {
        ctx = await getWatchPageVisitorData(videoId, true);
        ({ data, userAgent } = await callClient(ctx.visitorData, ctx.sts));
      }

      if (!data?.streamingData) continue;

      const chosen = selectBestAudioFormat(data.streamingData, prefer);
      if (!chosen?.url) continue;

      // 1.5 MiB Deep Probe verification (Range: bytes=1572864-1572900)
      let throttled = false;
      try {
        const probeRes = await httpGet(chosen.url, {
          'User-Agent': userAgent,
          Range: 'bytes=1572864-1572900',
        });
        if (probeRes.status !== 200 && probeRes.status !== 206) {
          throttled = true;
        }
      } catch (probeErr) {
        console.warn(`[nativeYtClient] Deep probe failed for ${videoId} (${clientName}):`, probeErr.message || probeErr);
        throttled = true;
      }

      const finalUrl = await wrapWithLocalProxy(chosen.url, userAgent);
      const result = {
        url: finalUrl,
        directUrl: chosen.url,
        videoId,
        mimeType: chosen.mimeType || 'audio/mp4',
        bitrate: chosen.bitrate || 128000,
        throttled,
        isNative: true,
        expiresIn: 12600,
      };

      if (!throttled) {
        return result;
      }

      if (!fallbackThrottledCandidate) {
        fallbackThrottledCandidate = result;
      }
    } catch (err) {
      console.warn(`[nativeYtClient] Client ${clientName} failed for ${videoId}:`, err.message || err);
    }
  }

  if (fallbackThrottledCandidate) {
    return fallbackThrottledCandidate;
  }

  throw new Error(`[nativeYtClient] No playable audio format found for ${videoId}`);
}

export const resolveNativeStreamUrl = resolveAudioStream;

/**
 * Parses a YouTube Music `musicResponsiveListItemRenderer` into a normalized track object.
 */
function parseMusicResponsiveTrack(renderer) {
  if (!renderer) return null;

  const flexCols = renderer.flexColumns || [];
  const titleRuns = flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const subtitleRuns = flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

  const videoId =
    renderer.playlistItemData?.videoId ||
    titleRuns[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
    renderer.navigationEndpoint?.watchEndpoint?.videoId;

  if (!videoId) return null;

  const title = titleRuns.map((r) => r.text).join('').trim() || 'Unknown Title';

  // Split subtitle runs by ' • '
  const segments = [];
  let currentSegment = '';
  for (const run of subtitleRuns) {
    if (run.text === ' • ') {
      if (currentSegment.trim()) segments.push(currentSegment.trim());
      currentSegment = '';
    } else {
      currentSegment += run.text || '';
    }
  }
  if (currentSegment.trim()) segments.push(currentSegment.trim());

  let artist = 'Unknown Artist';
  let durationFormatted = '3:30';
  let album = undefined;

  const filteredSegments = segments.filter(
    (s) => !['Song', 'Video', 'Single', 'EP', 'Album'].includes(s)
  );

  if (filteredSegments.length > 0) {
    artist = filteredSegments[0];
  }
  for (let i = filteredSegments.length - 1; i >= 1; i--) {
    if (/^\d+:\d+(:\d+)?$/.test(filteredSegments[i])) {
      durationFormatted = filteredSegments[i];
    } else if (!album && !filteredSegments[i].includes('plays') && !filteredSegments[i].includes('views')) {
      album = filteredSegments[i];
    }
  }

  const fixedCols = renderer.fixedColumns || [];
  const fixedText = fixedCols[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text;
  if (fixedText && /^\d+:\d+(:\d+)?$/.test(fixedText)) {
    durationFormatted = fixedText;
  }

  const thumbs = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  const rawThumb = thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : '';
  const upscaled =
    upscaleThumbnail(rawThumb) ||
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop';
  const durationSeconds = parseDurationSeconds(durationFormatted);

  return {
    id: videoId,
    videoId,
    title,
    artist,
    cover: upscaled,
    albumArt: upscaled,
    thumbnail_url: upscaled,
    thumbnailUrl: upscaled,
    duration: durationSeconds,
    seconds: durationSeconds,
    durationFormatted,
    album,
  };
}

/**
 * Parses a YouTube Music `musicResponsiveListItemRenderer` into a normalized artist object.
 */
function parseMusicResponsiveArtist(renderer) {
  if (!renderer) return null;
  const flexCols = renderer.flexColumns || [];
  const name = flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
    ?.map((r) => r.text)
    .join('')
    .trim();
  if (!name) return null;

  const browseId =
    renderer.navigationEndpoint?.browseEndpoint?.browseId ||
    flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
    name;

  const thumbs = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  const rawThumb = thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : '';
  const avatar =
    upscaleThumbnail(rawThumb) ||
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop';

  return {
    id: browseId,
    browseId,
    name,
    avatar,
    role: 'Artist',
  };
}

function extractShelfRenderers(data) {
  const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs ||
    data?.contents?.singleColumnBrowseResultsRenderer?.tabs ||
    [];
  const sectionContents = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
  const items = [];
  for (const sec of sectionContents) {
    const shelfItems = sec?.musicShelfRenderer?.contents || sec?.musicCarouselShelfRenderer?.contents || [];
    for (const entry of shelfItems) {
      if (entry.musicResponsiveListItemRenderer) {
        items.push(entry.musicResponsiveListItemRenderer);
      }
    }
  }
  return items;
}

/**
 * Native Search implementation via CapacitorHttp POST to https://music.youtube.com/youtubei/v1/search
 */
export async function search(query, limit = 40) {
  const tracks = [];
  const artists = [];
  const seenIds = new Set();

  try {
    // EgWKAQIIAWoKEAkQBRAKEAMQBA== filters for Songs; EgWKAQIgAWoKEAkQChAFEAMQBA== filters for Artists
    const [songRes, artistRes] = await Promise.allSettled([
      httpPost('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', YTM_HEADERS, {
        context: YTM_CONTEXT,
        query,
        params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA==',
      }),
      httpPost('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', YTM_HEADERS, {
        context: YTM_CONTEXT,
        query,
        params: 'EgWKAQIgAWoKEAkQChAFEAMQBA==',
      }),
    ]);

    if (songRes.status === 'fulfilled' && songRes.value?.data) {
      const renderers = extractShelfRenderers(songRes.value.data);
      for (const r of renderers) {
        const track = parseMusicResponsiveTrack(r);
        if (track && !seenIds.has(track.videoId)) {
          seenIds.add(track.videoId);
          tracks.push(track);
        }
      }
    }

    // Fallback to unfiltered YT Music search if song filter returned 0 tracks
    if (tracks.length === 0) {
      const generalRes = await httpPost(
        'https://music.youtube.com/youtubei/v1/search?prettyPrint=false',
        YTM_HEADERS,
        { context: YTM_CONTEXT, query }
      );
      if (generalRes?.data) {
        const renderers = extractShelfRenderers(generalRes.data);
        for (const r of renderers) {
          const track = parseMusicResponsiveTrack(r);
          if (track && !seenIds.has(track.videoId)) {
            seenIds.add(track.videoId);
            tracks.push(track);
          }
        }
      }
    }

    if (artistRes.status === 'fulfilled' && artistRes.value?.data) {
      const renderers = extractShelfRenderers(artistRes.value.data);
      const seenArtists = new Set();
      for (const r of renderers) {
        const artist = parseMusicResponsiveArtist(r);
        if (artist && !seenArtists.has(artist.name.toLowerCase())) {
          seenArtists.add(artist.name.toLowerCase());
          artists.push(artist);
          if (artists.length >= 8) break;
        }
      }
    }
  } catch (err) {
    console.warn('[nativeYtClient] Music search error:', err.message || err);
  }

  // Fallback to curated catalog if completely offline
  if (tracks.length === 0) {
    const defaultShelves = getCuratedHomeShelves();
    const qLower = String(query || '').toLowerCase();
    for (const shelf of defaultShelves.shelves) {
      for (const item of shelf.items) {
        if (
          !seenIds.has(item.videoId) &&
          (item.title.toLowerCase().includes(qLower) || item.artist.toLowerCase().includes(qLower))
        ) {
          seenIds.add(item.videoId);
          tracks.push(item);
        }
      }
    }
  }

  if (artists.length === 0 && tracks.length > 0) {
    const seen = new Set();
    for (const t of tracks) {
      const cleanName = t.artist?.split(/[,&]|feat\.|ft\./i)[0]?.trim();
      if (cleanName && !seen.has(cleanName.toLowerCase())) {
        seen.add(cleanName.toLowerCase());
        artists.push({
          id: cleanName,
          name: cleanName,
          avatar: t.cover,
          role: 'Artist',
        });
        if (artists.length >= 8) break;
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
      id: '2tOutF8B3f8',
      videoId: '2tOutF8B3f8',
      title: 'Daily Mix 01 • Xtal',
      artist: 'Aphex Twin, Blood Orange, Tirzah',
      duration: 291,
      seconds: 291,
      durationFormatted: '4:51',
      thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=544&h=544&fit=crop',
    },
    {
      id: 'dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      duration: 213,
      seconds: 213,
      durationFormatted: '3:33',
      thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
    },
    {
      id: 'sw4c17Z4N4I',
      videoId: 'sw4c17Z4N4I',
      title: 'N95',
      artist: 'Kendrick Lamar',
      duration: 195,
      seconds: 195,
      durationFormatted: '3:15',
      thumbnailUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=544&h=544&fit=crop',
    },
  ];

  const chillVibes = [
    {
      id: 'TCd6PfxOy0Y',
      videoId: 'TCd6PfxOy0Y',
      title: 'Veridis Quo',
      artist: 'Daft Punk',
      duration: 345,
      seconds: 345,
      durationFormatted: '5:45',
      thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=544&h=544&fit=crop',
    },
    {
      id: 'FvOpPeKSf_4',
      videoId: 'FvOpPeKSf_4',
      title: 'Glimpse of Us',
      artist: 'Joji',
      duration: 233,
      seconds: 233,
      durationFormatted: '3:53',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
    },
    {
      id: 'MV_3Dpw-BRY',
      videoId: 'MV_3Dpw-BRY',
      title: 'Nightcall (Ambient Mix)',
      artist: 'Kavinsky',
      duration: 252,
      seconds: 252,
      durationFormatted: '4:12',
      thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
    },
  ];

  const hipHop = [
    {
      id: 'hI8A14Qcv68',
      videoId: 'hI8A14Qcv68',
      title: 'N.Y. State of Mind',
      artist: 'Nas, DJ Premier',
      duration: 294,
      seconds: 294,
      durationFormatted: '4:54',
      thumbnailUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=544&h=544&fit=crop',
    },
    {
      id: 'r4l9bFqgMaQ',
      videoId: 'r4l9bFqgMaQ',
      title: 'First Person Shooter',
      artist: 'Drake ft. J. Cole',
      duration: 247,
      seconds: 247,
      durationFormatted: '4:07',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
    },
  ];

  const lateNight = [
    {
      id: 'MV_3Dpw-BRY',
      videoId: 'MV_3Dpw-BRY',
      title: 'Nightcall (Runway Edit)',
      artist: 'Kavinsky, Lovefoxxx',
      duration: 252,
      seconds: 252,
      durationFormatted: '4:12',
      thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
    },
    {
      id: 'O1OTWCd40bc',
      videoId: 'O1OTWCd40bc',
      title: 'Wicked Games',
      artist: 'The Weeknd',
      duration: 325,
      seconds: 325,
      durationFormatted: '5:25',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
      cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
    },
  ];

  const madeForYou = {
    id: '2tOutF8B3f8',
    videoId: '2tOutF8B3f8',
    title: 'Daily Mix 01 • Xtal',
    artist: 'Aphex Twin, Blood Orange, Tirzah',
    duration: 291,
    seconds: 291,
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
 * Native Artist lookup via https://music.youtube.com/youtubei/v1/search & /browse
 */
export async function getArtist(name, limit = 60) {
  const tracks = [];
  const seenIds = new Set();
  let artistAvatar = '';

  try {
    const [artistSearch, songSearch] = await Promise.allSettled([
      httpPost('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', YTM_HEADERS, {
        context: YTM_CONTEXT,
        query: name,
        params: 'EgWKAQIgAWoKEAkQChAFEAMQBA==',
      }),
      httpPost('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', YTM_HEADERS, {
        context: YTM_CONTEXT,
        query: `${name} official audio`,
        params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA==',
      }),
    ]);

    if (artistSearch.status === 'fulfilled' && artistSearch.value?.data) {
      const artistRenderers = extractShelfRenderers(artistSearch.value.data);
      const firstArtist = parseMusicResponsiveArtist(artistRenderers[0]);
      if (firstArtist?.avatar) artistAvatar = firstArtist.avatar;

      if (firstArtist?.browseId && firstArtist.browseId.startsWith('UC')) {
        const browseRes = await httpPost(
          'https://music.youtube.com/youtubei/v1/browse?prettyPrint=false',
          YTM_HEADERS,
          { context: YTM_CONTEXT, browseId: firstArtist.browseId }
        );
        if (browseRes?.data) {
          const browseRenderers = extractShelfRenderers(browseRes.data);
          for (const r of browseRenderers) {
            const track = parseMusicResponsiveTrack(r);
            if (track && !seenIds.has(track.videoId)) {
              seenIds.add(track.videoId);
              tracks.push(track);
            }
          }
        }
      }
    }

    if (songSearch.status === 'fulfilled' && songSearch.value?.data) {
      const songRenderers = extractShelfRenderers(songSearch.value.data);
      for (const r of songRenderers) {
        const track = parseMusicResponsiveTrack(r);
        if (track && !seenIds.has(track.videoId)) {
          seenIds.add(track.videoId);
          tracks.push(track);
          if (tracks.length >= limit) break;
        }
      }
    }
  } catch (err) {
    console.warn('[nativeYtClient] getArtist error:', err.message || err);
  }

  if (tracks.length === 0) {
    const fallback = await search(name, limit);
    tracks.push(...fallback.tracks);
  }

  const sliced = tracks.slice(0, limit);
  const avatar =
    artistAvatar ||
    sliced[0]?.cover ||
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop';

  return {
    status: 'success',
    data: sliced,
    tracks: sliced,
    artist: {
      id: name,
      name,
      avatar,
    },
  };
}

/**
 * Native Up Next lookup via https://music.youtube.com/youtubei/v1/next
 */
export async function getUpNext(videoId) {
  const tracks = [];
  const seenIds = new Set([videoId]);

  try {
    const res = await httpPost(
      'https://music.youtube.com/youtubei/v1/next?prettyPrint=false',
      YTM_HEADERS,
      {
        context: YTM_CONTEXT,
        videoId,
        playlistId: `RDAMVM${videoId}`,
        isAudioOnly: true,
        enablePersistentPlaylistPanel: true,
      }
    );

    const panelContents =
      res?.data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
        ?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer
        ?.content?.playlistPanelRenderer?.contents || [];

    for (const item of panelContents) {
      const p = item.playlistPanelVideoRenderer;
      if (!p?.videoId || seenIds.has(p.videoId)) continue;
      seenIds.add(p.videoId);

      const title = p.title?.runs?.map((r) => r.text).join('').trim() || 'Unknown Title';
      const byline =
        p.longBylineText?.runs?.map((r) => r.text).join('') ||
        p.shortBylineText?.runs?.map((r) => r.text).join('') ||
        'Unknown Artist';
      const artist = byline.split(' • ')[0]?.trim() || 'Unknown Artist';
      const durationFormatted = p.lengthText?.runs?.[0]?.text || '3:30';
      const durationSeconds = parseDurationSeconds(durationFormatted);
      const thumbs = p.thumbnail?.thumbnails || [];
      const rawThumb = thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : '';
      const upscaled =
        upscaleThumbnail(rawThumb) ||
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop';

      tracks.push({
        id: p.videoId,
        videoId: p.videoId,
        title,
        artist,
        cover: upscaled,
        albumArt: upscaled,
        thumbnail_url: upscaled,
        thumbnailUrl: upscaled,
        duration: durationSeconds,
        seconds: durationSeconds,
        durationFormatted,
      });
    }
  } catch (err) {
    console.warn('[nativeYtClient] getUpNext error:', err.message || err);
  }

  if (tracks.length === 0) {
    const defaultShelves = getCuratedHomeShelves();
    const allTracks = defaultShelves.shelves.flatMap((s) => s.items);
    for (const t of allTracks) {
      if (!seenIds.has(t.videoId)) {
        seenIds.add(t.videoId);
        tracks.push(t);
      }
    }
  }

  return { tracks };
}

/**
 * Native Import Tracklist
 */
export async function importTracklist(tracklist) {
  if (!Array.isArray(tracklist)) return { tracks: [] };
  const results = [];
  for (const query of tracklist.slice(0, 20)) {
    const res = await search(query, 1);
    if (res.tracks.length > 0) {
      results.push(res.tracks[0]);
    }
  }
  return { tracks: results };
}

export default {
  resolveAudioStream,
  resolveNativeStreamUrl,
  getWatchPageVisitorData,
  getLocalProxyUrl,
  getLocalProxyPort,
  getProxySecret,
  setNativeProxySecretForTesting,
  search,
  getHomeShelves,
  getArtist,
  getUpNext,
  importTracklist,
  upscaleThumbnail,
};
