/**
 * In-app update checker backed by GitHub Releases.
 * Pure helpers are exported so they can be unit-tested under `node --test`.
 */

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

const DEFAULT_REPO = 'ekanshs25160-bit/super-culture-v2';
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export const GITHUB_REPO = (() => {
  const configured = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GITHUB_REPO : '';
  return configured && REPO_PATTERN.test(configured) ? configured : DEFAULT_REPO;
})();

export const UPDATE_CACHE_KEY = 'super_culture_update_check';
export const UPDATE_DISMISSED_KEY = 'super_culture_update_dismissed';
export const UPDATE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/** Strips a leading "v" and any pre-release/build suffix, returning numeric parts. */
function parseVersion(v) {
  return String(v || '')
    .trim()
    .replace(/^v/i, '')
    .split(/[-+]/)[0]
    .split('.')
    .map((p) => parseInt(p, 10) || 0);
}

/** Returns 1 if a > b, -1 if a < b, 0 if equal. */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

export function summarizeNotes(body, maxLen = 280) {
  const text = String(body || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen - 1).trimEnd()}…` : text;
}

function isTrustedDownloadUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      (u.hostname === 'github.com' || u.hostname.endsWith('.githubusercontent.com'))
    );
  } catch {
    return false;
  }
}

/** Converts a GitHub "latest release" payload into a compact update descriptor. */
export function parseRelease(release, currentVersion = APP_VERSION) {
  const latestVersion = String(release?.tag_name || '').trim().replace(/^v/i, '');
  const apkAsset = (release?.assets || []).find(
    (a) => /\.apk$/i.test(a?.name || '') && isTrustedDownloadUrl(a?.browser_download_url)
  );
  const releaseUrl = isTrustedDownloadUrl(release?.html_url)
    ? release.html_url
    : `https://github.com/${GITHUB_REPO}/releases/latest`;
  return {
    currentVersion,
    latestVersion,
    hasUpdate: !!latestVersion && compareVersions(latestVersion, currentVersion) > 0,
    notes: summarizeNotes(release?.body),
    apkUrl: apkAsset ? apkAsset.browser_download_url : null,
    releaseUrl,
  };
}

function safeStorage(storage) {
  if (storage) return storage;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Checks GitHub for a newer release. Results are cached for 12 hours unless `force` is set.
 * Throws on network / HTTP errors when `force` is true; otherwise failures resolve to null.
 */
export async function checkForUpdate({
  force = false,
  fetchImpl = typeof fetch !== 'undefined' ? fetch : null,
  storage,
  now = Date.now(),
  currentVersion = APP_VERSION,
} = {}) {
  const store = safeStorage(storage);

  if (!force && store) {
    try {
      const cached = JSON.parse(store.getItem(UPDATE_CACHE_KEY) || 'null');
      if (cached && now - cached.checkedAt < UPDATE_CACHE_TTL_MS && cached.result) {
        // Re-evaluate against the running version in case the app was upgraded since caching.
        return {
          ...cached.result,
          currentVersion,
          hasUpdate: compareVersions(cached.result.latestVersion, currentVersion) > 0,
          checkedAt: cached.checkedAt,
          fromCache: true,
        };
      }
    } catch {
      /* ignore corrupt cache */
    }
  }

  try {
    if (!fetchImpl) throw new Error('fetch unavailable');
    const res = await fetchImpl(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    const result = parseRelease(await res.json(), currentVersion);
    try {
      store?.setItem(UPDATE_CACHE_KEY, JSON.stringify({ checkedAt: now, result }));
    } catch {
      /* storage full / unavailable */
    }
    return { ...result, checkedAt: now, fromCache: false };
  } catch (err) {
    if (force) throw err;
    return null;
  }
}

/** Opens a URL in the system browser (Capacitor routes window.open to an external intent). */
export function openExternal(url) {
  if (typeof window === 'undefined' || !url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}
