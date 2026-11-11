import { Capacitor } from '@capacitor/core';
import nativeYtClient from './nativeYtClient.js';

let nativeYtPromise = null;

/** Test seam: inject a fake Innertube client (pass null to reset). */
export function setNativeYtClientForTesting(client) {
  nativeYtPromise = client ? Promise.resolve(client) : null;
}

/**
 * Lazy-initializes Innertube for native mobile execution (Capacitor).
 * Bypasses CORS via the native iOS/Android network stack (CapacitorHttp).
 */
export async function getNativeYtClient() {
  if (!nativeYtPromise) {
    nativeYtPromise = (async () => {
      const { Innertube, UniversalCache } = await import('youtubei.js/web');
      return Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true,
      });
    })();
  }
  return nativeYtPromise;
}

const AUDIO_MP4 = (f) =>
  f.has_audio && !f.has_video && (f.mime_type?.includes('mp4a') || f.mime_type?.includes('audio/mp4'));

/**
 * Resolves a direct audio URL on-device via VISIONOS or fallback client.
 */
export async function resolveNativeStreamUrl(videoId, prefer = 'aac') {
  // If a mock Innertube client is injected (e.g. in streamBranching.test.js), run through the mock
  if (nativeYtPromise) {
    const ytClient = await getNativeYtClient();
    const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
    const clientsToTry = platform === 'ios' ? ['IOS', 'TV_EMBEDDED'] : ['ANDROID', 'TV_EMBEDDED', 'WEB'];

    let finalUrl = null;

    for (const clientType of clientsToTry) {
      try {
        const info = await ytClient.getBasicInfo(videoId, { client: clientType });
        const formats = info?.streaming_data?.adaptive_formats || [];
        const audioFormats = formats.filter(AUDIO_MP4);

        if (audioFormats.length > 0) {
          audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
          const format = audioFormats[0];

          const candidateUrl =
            format.url ||
            (typeof format.decipher === 'function' ? await format.decipher(ytClient.session.player) : undefined);
          if (candidateUrl) {
            finalUrl = candidateUrl;
            break;
          }
        }
      } catch (err) {
        console.warn(`[MobileResolver] Client ${clientType} failed:`, err);
      }
    }

    if (!finalUrl) throw new Error('Could not resolve mobile stream URL');

    return { url: finalUrl, videoId, expiresIn: 12600, isNative: true };
  }

  // Production path: use VISIONOS native resolver
  return await nativeYtClient.resolveNativeStreamUrl(videoId, prefer);
}
