/**
 * IndexedDB Audio Storage Utility
 * Provides persistent offline blob storage for audio tracks in desktop & web browsers.
 */

const DB_NAME = 'superculture_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'superculture_offline_audio';

let dbPromise = null;

function getIndexedDB() {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  if (typeof globalThis !== 'undefined' && globalThis.indexedDB) {
    return globalThis.indexedDB;
  }
  return null;
}

export function openAudioDB() {
  const idb = getIndexedDB();
  if (!idb) {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'videoId' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (err) => {
        console.warn('[indexedDbAudio] openAudioDB error:', err);
        resolve(null);
      };
    } catch (err) {
      console.warn('[indexedDbAudio] openAudioDB failed:', err);
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Stores an audio Blob in IndexedDB under the track's videoId.
 * @param {string} videoId
 * @param {Blob} blob
 * @param {string} mimeType
 * @returns {Promise<boolean>}
 */
export async function saveOfflineAudioBlob(videoId, blob, mimeType = 'audio/mp4') {
  if (!videoId || !blob) return false;
  try {
    const db = await openAudioDB();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        videoId,
        blob,
        mimeType: mimeType || blob.type || 'audio/mp4',
        size: blob.size,
        timestamp: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = (err) => {
        console.warn(`[indexedDbAudio] save failed for ${videoId}:`, err);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn(`[indexedDbAudio] saveOfflineAudioBlob error:`, err);
    return false;
  }
}

/**
 * Retrieves the audio Blob stored for a given videoId.
 * @param {string} videoId
 * @returns {Promise<Blob|null>}
 */
export async function getOfflineAudioBlob(videoId) {
  if (!videoId) return null;
  try {
    const db = await openAudioDB();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(videoId);
      req.onsuccess = () => {
        const res = req.result;
        if (res && res.blob instanceof Blob) {
          resolve(res.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Deletes an audio Blob from IndexedDB.
 * @param {string} videoId
 * @returns {Promise<boolean>}
 */
export async function deleteOfflineAudioBlob(videoId) {
  if (!videoId) return false;
  try {
    const db = await openAudioDB();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(videoId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Checks whether an offline audio blob exists in IndexedDB for the videoId.
 * @param {string} videoId
 * @returns {Promise<boolean>}
 */
export async function hasOfflineAudio(videoId) {
  if (!videoId) return false;
  const blob = await getOfflineAudioBlob(videoId);
  return Boolean(blob && blob.size > 0);
}

/**
 * Clears all audio blobs from IndexedDB.
 * @returns {Promise<boolean>}
 */
export async function clearOfflineAudioDB() {
  try {
    const db = await openAudioDB();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
