/* global global */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock Browser Environment
const localStorageStore = new Map();
global.localStorage = {
  getItem: (key) => localStorageStore.get(key) || null,
  setItem: (key, val) => localStorageStore.set(key, String(val)),
  removeItem: (key) => localStorageStore.delete(key),
  clear: () => localStorageStore.clear(),
};

global.window = {
  location: { origin: 'http://localhost:3000' },
};

import { useLibraryStore } from '../store/useLibraryStore.js';
import { apiClient } from '../services/api.js';

describe('useLibraryStore Playlist Deletion & Track Removal Suite', () => {
  beforeEach(() => {
    localStorageStore.clear();
    useLibraryStore.setState({
      playlists: [
        {
          id: 'test-pl-1',
          name: 'Summer Vibes',
          tracks: [
            { videoId: 'v1', id: 'v1', title: 'Song 1', artist: 'Artist 1' },
            { videoId: 'v2', id: 'v2', title: 'Song 2', artist: 'Artist 2' },
          ],
        },
        {
          id: 'test-pl-2',
          name: 'Chill Lounge',
          tracks: [],
        },
      ],
      likedSongs: [],
      error: null,
    });
  });

  it('refuses to delete Liked Songs pinned vault (id: liked-songs)', async () => {
    const res = await useLibraryStore.getState().deletePlaylist('liked-songs');
    assert.equal(res, false);
    assert.equal(useLibraryStore.getState().playlists.length, 2);
  });

  it('optimistically deletes playlist and calls backend API', async () => {
    let deletedId = null;
    const originalDelete = apiClient.library.deletePlaylist;
    apiClient.library.deletePlaylist = async (id) => {
      deletedId = id;
      return { ok: true };
    };

    try {
      const res = await useLibraryStore.getState().deletePlaylist('test-pl-1');
      assert.equal(res, true);
      assert.equal(deletedId, 'test-pl-1');

      const currentPlaylists = useLibraryStore.getState().playlists;
      assert.equal(currentPlaylists.length, 1);
      assert.equal(currentPlaylists[0].id, 'test-pl-2');
    } finally {
      apiClient.library.deletePlaylist = originalDelete;
    }
  });

  it('rolls back playlist state when backend API call fails', async () => {
    const originalDelete = apiClient.library.deletePlaylist;
    apiClient.library.deletePlaylist = async () => {
      throw new Error('Network error during deletion');
    };

    try {
      const res = await useLibraryStore.getState().deletePlaylist('test-pl-1');
      assert.equal(res, false);

      const currentPlaylists = useLibraryStore.getState().playlists;
      assert.equal(currentPlaylists.length, 2);
      assert.equal(currentPlaylists[0].id, 'test-pl-1');
      assert.equal(useLibraryStore.getState().error, 'Failed to delete playlist');
    } finally {
      apiClient.library.deletePlaylist = originalDelete;
    }
  });

  it('removes track from playlist and syncs with backend API', async () => {
    let removedArgs = null;
    const originalRemove = apiClient.library.removeTrackFromPlaylist;
    apiClient.library.removeTrackFromPlaylist = async (plId, vid) => {
      removedArgs = { plId, vid };
      return { ok: true };
    };

    try {
      const res = await useLibraryStore.getState().removeTrackFromPlaylist('test-pl-1', 'v1');
      assert.equal(res.removed, true);
      assert.deepEqual(removedArgs, { plId: 'test-pl-1', vid: 'v1' });

      const updated = useLibraryStore.getState().playlists.find((p) => p.id === 'test-pl-1');
      assert.equal(updated.tracks.length, 1);
      assert.equal(updated.tracks[0].videoId, 'v2');
    } finally {
      apiClient.library.removeTrackFromPlaylist = originalRemove;
    }
  });
});
