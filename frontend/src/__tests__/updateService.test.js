import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareVersions,
  parseRelease,
  summarizeNotes,
  checkForUpdate,
  UPDATE_CACHE_KEY,
} from '../services/updateService.js';

const memStore = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

const release = {
  tag_name: 'v2.1.0',
  html_url: 'https://github.com/o/r/releases/tag/v2.1.0',
  body: '## What\'s new\n- **Faster** startup [link](https://x.y)',
  assets: [
    { name: 'notes.txt', browser_download_url: 'https://github.com/o/r/releases/download/v2.1.0/notes.txt' },
    { name: 'app.apk', browser_download_url: 'https://github.com/o/r/releases/download/v2.1.0/app.apk' },
  ],
};

test('compareVersions strips leading v and compares numerically', () => {
  assert.equal(compareVersions('v2.10.0', '2.9.9'), 1);
  assert.equal(compareVersions('2.0.0', 'v2.0.0'), 0);
  assert.equal(compareVersions('1.9.9', '2.0.0'), -1);
  assert.equal(compareVersions('2.0', '2.0.1'), -1);
});

test('parseRelease finds apk asset and flags newer versions', () => {
  const r = parseRelease(release, '2.0.0');
  assert.equal(r.hasUpdate, true);
  assert.equal(r.latestVersion, '2.1.0');
  assert.match(r.apkUrl, /app\.apk$/);
  assert.equal(r.notes, "What's new - Faster startup link");
  assert.equal(parseRelease(release, '2.1.0').hasUpdate, false);
});

test('parseRelease rejects untrusted download hosts and falls back to release page', () => {
  const evil = { ...release, html_url: 'https://evil.com/x', assets: [{ name: 'a.apk', browser_download_url: 'https://evil.com/a.apk' }] };
  const r = parseRelease(evil, '1.0.0');
  assert.equal(r.apkUrl, null);
  assert.match(r.releaseUrl, /^https:\/\/github\.com\//);
});

test('summarizeNotes truncates long bodies', () => {
  assert.ok(summarizeNotes('a'.repeat(1000)).length <= 280);
});

test('checkForUpdate caches for 12h and force bypasses the cache', async () => {
  const store = memStore();
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: true, json: async () => release }; };
  const t0 = 1_000_000;
  const a = await checkForUpdate({ fetchImpl, storage: store, now: t0, currentVersion: '2.0.0' });
  assert.equal(a.hasUpdate, true);
  await checkForUpdate({ fetchImpl, storage: store, now: t0 + 60_000, currentVersion: '2.0.0' });
  assert.equal(calls, 1);
  assert.ok(store.getItem(UPDATE_CACHE_KEY));
  await checkForUpdate({ fetchImpl, storage: store, now: t0 + 13 * 3600_000, currentVersion: '2.0.0' });
  assert.equal(calls, 2);
  await checkForUpdate({ fetchImpl, storage: store, now: t0 + 13 * 3600_000 + 1, force: true, currentVersion: '2.0.0' });
  assert.equal(calls, 3);
});

test('checkForUpdate swallows errors unless forced', async () => {
  const fetchImpl = async () => ({ ok: false, status: 403 });
  assert.equal(await checkForUpdate({ fetchImpl, storage: memStore() }), null);
  await assert.rejects(checkForUpdate({ fetchImpl, storage: memStore(), force: true }));
});
