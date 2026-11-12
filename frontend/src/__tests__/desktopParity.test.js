import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Set up globals for test
const localStorageStore = new Map();
global.localStorage = {
  getItem: (key) => localStorageStore.get(key) || null,
  setItem: (key, val) => localStorageStore.set(key, String(val)),
  removeItem: (key) => localStorageStore.delete(key),
  clear: () => localStorageStore.clear(),
};

// Mock IndexedDB
class MockIDBRequest {
  constructor() {
    this.result = null;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }
}

class MockIDBObjectStore {
  constructor(dataMap) {
    this.dataMap = dataMap;
  }
  put(record) {
    const req = new MockIDBRequest();
    this.dataMap.set(record.videoId, record);
    setTimeout(() => {
      req.result = record.videoId;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
  get(key) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = this.dataMap.get(key) || null;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
  delete(key) {
    const req = new MockIDBRequest();
    this.dataMap.delete(key);
    setTimeout(() => {
      req.result = undefined;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
  clear() {
    const req = new MockIDBRequest();
    this.dataMap.clear();
    setTimeout(() => {
      req.result = undefined;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
}

class MockIDBDatabase {
  constructor() {
    this.dataMap = new Map();
    this.objectStoreNames = {
      contains: () => true,
    };
  }
  transaction() {
    return {
      objectStore: () => new MockIDBObjectStore(this.dataMap),
    };
  }
}

const mockIDBInstance = new MockIDBDatabase();
global.indexedDB = {
  open: () => {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = mockIDBInstance;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  },
};

global.Blob = class Blob {
  constructor(chunks = [], options = {}) {
    this.chunks = chunks;
    this.type = options.type || '';
    this.size = chunks.reduce((acc, c) => acc + (c.length || 0), 0);
  }
};

global.URL = {
  createObjectURL: (blob) => `blob:super-culture-offline-${blob.size}`,
  revokeObjectURL: () => {},
};

import {
  saveOfflineAudioBlob,
  getOfflineAudioBlob,
  deleteOfflineAudioBlob,
  hasOfflineAudio,
} from '../utils/indexedDbAudio.js';
import { isEditableTarget, handleKeyboardShortcut } from '../utils/keyboardShortcuts.js';
import { useLibraryStore } from '../store/useLibraryStore.js';
import { apiClient } from '../services/api.js';

describe('Desktop Parity Suite: Keyboard Shortcuts, IndexedDB & Batch Persistence', () => {
  beforeEach(() => {
    localStorageStore.clear();
    mockIDBInstance.dataMap.clear();
  });

  describe('1. Keyboard Shortcut Target Filtering & Actions', () => {
    it('detects input, textarea, select, and contenteditable elements correctly', () => {
      assert.equal(isEditableTarget({ tagName: 'INPUT' }), true);
      assert.equal(isEditableTarget({ tagName: 'TEXTAREA' }), true);
      assert.equal(isEditableTarget({ tagName: 'SELECT' }), true);
      assert.equal(isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);
      assert.equal(isEditableTarget({ tagName: 'BUTTON' }), false);
      assert.equal(isEditableTarget({ tagName: 'DIV', isContentEditable: false }), false);
      assert.equal(isEditableTarget(null), false);
    });

    it('triggers transport and seeking actions for keyboard events when outside inputs', () => {
      const actions = [];
      const mockState = {
        togglePlay: () => actions.push('togglePlay'),
        skipNext: () => actions.push('skipNext'),
        skipPrev: () => actions.push('skipPrev'),
        seekTo: (sec) => actions.push(`seekTo:${sec}`),
        currentTime: 30,
        duration: 200,
        volume: 0.8,
        setVolumeLevel: (v) => actions.push(`volume:${v}`),
        toggleShuffle: () => actions.push('toggleShuffle'),
        toggleRepeat: () => actions.push('toggleRepeat'),
        showToast: (msg) => actions.push(`toast:${msg}`),
      };
      const lastVolumeRef = { current: 0.8 };

      // Space -> togglePlay
      const resSpace = handleKeyboardShortcut({ code: 'Space', key: ' ' }, mockState, lastVolumeRef);
      assert.equal(resSpace, 'togglePlay');
      assert.equal(actions.includes('togglePlay'), true);

      // KeyN -> skipNext
      const resN = handleKeyboardShortcut({ code: 'KeyN', key: 'n' }, mockState, lastVolumeRef);
      assert.equal(resN, 'skipNext');
      assert.equal(actions.includes('skipNext'), true);

      // Shift+ArrowRight -> skipNext
      const resShiftRight = handleKeyboardShortcut({ code: 'ArrowRight', key: 'ArrowRight', shiftKey: true }, mockState, lastVolumeRef);
      assert.equal(resShiftRight, 'skipNext');

      // KeyP -> skipPrev
      const resP = handleKeyboardShortcut({ code: 'KeyP', key: 'p' }, mockState, lastVolumeRef);
      assert.equal(resP, 'skipPrev');

      // Shift+ArrowLeft -> skipPrev
      const resShiftLeft = handleKeyboardShortcut({ code: 'ArrowLeft', key: 'ArrowLeft', shiftKey: true }, mockState, lastVolumeRef);
      assert.equal(resShiftLeft, 'skipPrev');

      // ArrowRight -> seek +5s (30 -> 35)
      const resRight = handleKeyboardShortcut({ code: 'ArrowRight', key: 'ArrowRight', shiftKey: false }, mockState, lastVolumeRef);
      assert.equal(resRight, 'seekForward');
      assert.equal(actions.includes('seekTo:35'), true);

      // ArrowLeft -> seek -5s (30 -> 25)
      const resLeft = handleKeyboardShortcut({ code: 'ArrowLeft', key: 'ArrowLeft', shiftKey: false }, mockState, lastVolumeRef);
      assert.equal(resLeft, 'seekBackward');
      assert.equal(actions.includes('seekTo:25'), true);

      // KeyS -> toggleShuffle
      const resS = handleKeyboardShortcut({ code: 'KeyS', key: 's' }, mockState, lastVolumeRef);
      assert.equal(resS, 'toggleShuffle');
      assert.equal(actions.includes('toggleShuffle'), true);

      // KeyR -> toggleRepeat
      const resR = handleKeyboardShortcut({ code: 'KeyR', key: 'r' }, mockState, lastVolumeRef);
      assert.equal(resR, 'toggleRepeat');
      assert.equal(actions.includes('toggleRepeat'), true);

      // KeyM -> toggle mute
      const resMute = handleKeyboardShortcut({ code: 'KeyM', key: 'm' }, mockState, lastVolumeRef);
      assert.equal(resMute, 'mute');
      assert.equal(actions.includes('volume:0'), true);

      // KeyM again with volume 0 -> un-mute and restore 0.8
      mockState.volume = 0;
      const resUnmute = handleKeyboardShortcut({ code: 'KeyM', key: 'm' }, mockState, lastVolumeRef);
      assert.equal(resUnmute, 'unmute');
      assert.equal(actions.includes('volume:0.8'), true);

      // Ignored when typing in input
      const resInput = handleKeyboardShortcut({ code: 'Space', key: ' ', target: { tagName: 'INPUT' } }, mockState, lastVolumeRef);
      assert.equal(resInput, null);

      // Ignored when Ctrl/Cmd held down
      const resCtrl = handleKeyboardShortcut({ code: 'KeyN', key: 'n', ctrlKey: true }, mockState, lastVolumeRef);
      assert.equal(resCtrl, null);
    });
  });

  describe('2. IndexedDB Audio Storage Operations', () => {
    it('saves audio blob, verifies existence, retrieves blob, and deletes it', async () => {
      const videoId = 'test-idb-audio-1';
      const fakeBlob = new global.Blob(['dummy-audio-bytes-12345'], { type: 'audio/mp4' });

      // Check initially absent
      const initialHas = await hasOfflineAudio(videoId);
      assert.equal(initialHas, false);

      // Save blob
      const saved = await saveOfflineAudioBlob(videoId, fakeBlob, 'audio/mp4');
      assert.equal(saved, true);

      // Check presence
      const hasAfterSave = await hasOfflineAudio(videoId);
      assert.equal(hasAfterSave, true);

      // Retrieve blob
      const retrieved = await getOfflineAudioBlob(videoId);
      assert.ok(retrieved instanceof global.Blob);
      assert.equal(retrieved.size, fakeBlob.size);

      // Delete blob
      const deleted = await deleteOfflineAudioBlob(videoId);
      assert.equal(deleted, true);

      // Verify gone
      const hasAfterDelete = await hasOfflineAudio(videoId);
      assert.equal(hasAfterDelete, false);
    });
  });

  describe('3. Web SQLite Library Batch Persistence', () => {
    it('persists batch tracks to backend SQLite via apiClient.library.addTracksBatch', async () => {
      let batchCalledWith = null;

      // Mock apiClient
      apiClient.library.createPlaylist = async (name, desc) => ({
        id: 'pl-backend-123',
        name,
        description: desc,
        tracks: [],
      });

      apiClient.library.addTracksBatch = async (playlistId, tracks) => {
        batchCalledWith = { playlistId, tracks };
        return { ok: true, count: tracks.length };
      };

      const tracksToImport = [
        { videoId: 'v1', title: 'Song 1', artist: 'Artist 1', duration: 200 },
        { videoId: 'v2', title: 'Song 2', artist: 'Artist 2', duration: 180 },
      ];

      const res = await useLibraryStore.getState().createPlaylistWithMultipleTracks('My Imported Album', tracksToImport);

      assert.ok(res);
      assert.equal(res.name, 'My Imported Album');
      assert.equal(res.tracks.length, 2);

      // Ensure API batch endpoint was invoked with the playlist ID and normalized tracks
      assert.ok(batchCalledWith);
      assert.equal(batchCalledWith.playlistId, 'pl-backend-123');
      assert.equal(batchCalledWith.tracks.length, 2);
      assert.equal(batchCalledWith.tracks[0].videoId, 'v1');
      assert.equal(batchCalledWith.tracks[1].videoId, 'v2');
    });

    it('persists single track to backend SQLite via apiClient.library.addTrackToPlaylist', async () => {
      let singleTrackCalledWith = null;

      apiClient.library.addTrackToPlaylist = async (playlistId, track) => {
        singleTrackCalledWith = { playlistId, track };
        return { ok: true, track };
      };

      useLibraryStore.setState({
        playlists: [
          { id: 'pl-existing-456', name: 'Existing Playlist', tracks: [] },
        ],
      });

      const trackToAdd = { videoId: 'v-single-add', title: 'Single Track', artist: 'Artist X', duration: 210 };
      const addResult = useLibraryStore.getState().addTrackToPlaylist('pl-existing-456', trackToAdd);

      assert.equal(addResult.added, true);
      assert.equal(addResult.playlistName, 'Existing Playlist');

      // Wait a microtick for the background promise
      await new Promise((r) => setTimeout(r, 10));

      assert.ok(singleTrackCalledWith);
      assert.equal(singleTrackCalledWith.playlistId, 'pl-existing-456');
      assert.equal(singleTrackCalledWith.track.videoId, 'v-single-add');
    });
  });
});
