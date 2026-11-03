/* global global */
import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

// Mock window
global.window = {
  location: { protocol: 'http:', host: 'localhost:5001' },
};

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.OPEN;
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 10);
  }
  send(data) {
    MockWebSocket.sentMessages.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
}
MockWebSocket.sentMessages = [];
global.WebSocket = MockWebSocket;

const { useJamStore, getStoredUserId } = await import('../store/useJamStore.js');
const { jamSocket } = await import('../services/jamSocket.js');
const { useUiStore } = await import('../store/useUiStore.js');

describe('useJamStore & Jam Room State Suite', () => {
  after(() => {
    jamSocket.disconnect();
  });

  beforeEach(() => {
    mockStorage.clear();
    MockWebSocket.sentMessages = [];
    useJamStore.setState({
      currentRoom: null,
      activeRooms: [],
      socketConnected: false,
    });
  });

  it('1. retrieves persistent userId or generates a random UUID and saves to localStorage', () => {
    assert.equal(mockStorage.has('sc_user_id'), false);
    const userId = getStoredUserId();
    assert.ok(userId, 'Should return a valid userId');
    assert.equal(typeof userId, 'string');
    assert.equal(mockStorage.get('sc_user_id'), userId);

    // Subsequent retrieval uses the cached key
    mockStorage.set('sc_user_id', 'custom-persisted-user-999');
    assert.equal(getStoredUserId(), 'custom-persisted-user-999');
  });

  it('2. createJamRoom emits create_room with userId as hostId', async () => {
    const store = useJamStore.getState();
    const userId = store.userId;

    // Mock apiClient.jam.createRoom
    const { apiClient } = await import('../services/api.js');
    apiClient.jam.createRoom = async (name, isPrivate) => ({
      room: {
        id: 'room-test-123',
        roomId: 'room-test-123',
        name,
        hostId: userId,
        isPrivate,
      },
    });

    const room = await store.createJamRoom('Indie Synth Waves');

    assert.ok(room, 'Room object should be returned');
    assert.equal(room.hostId, userId, 'Room hostId must match persistent userId');

    // Verify socket emission
    const createMsg = MockWebSocket.sentMessages.find((m) => m.type === 'create_room');
    assert.ok(createMsg, 'create_room message should be sent via WebSocket');
    assert.equal(createMsg.hostId, userId);
    assert.equal(createMsg.roomId, room.roomId || room.id);
  });

  it('3. room_snapshot updates local player state and triggers sync handlers', async () => {
    const store = useJamStore.getState();
    const roomId = 'test-snapshot-room-1';

    // Set initial room state
    useJamStore.setState({
      currentRoom: { id: roomId, roomId, name: 'Snapshot Room', hostId: 'host-1', queue: [] },
    });

    let snapshotPayloadReceived = null;
    store.registerAudioSyncHandlers({
      onRoomSnapshot: (data) => {
        snapshotPayloadReceived = data;
      },
    });

    store.connectSocket(roomId, 'guest-user-123');

    // Simulate server emitting room_snapshot
    const incomingTrack = { id: 't1', videoId: 'v123', title: 'Solar Pulse' };
    jamSocket.emit('room_snapshot', {
      type: 'room_snapshot',
      roomId,
      payload: {
        currentTrack: incomingTrack,
        currentTime: 45000,
        isPlaying: true,
        queue: [incomingTrack],
      },
    });

    // Check store state updated
    const updatedRoom = useJamStore.getState().currentRoom;
    assert.deepEqual(updatedRoom.currentTrack, incomingTrack);
    assert.equal(updatedRoom.state, 'playing');

    // Check external audio sync handler triggered
    assert.ok(snapshotPayloadReceived);
    assert.deepEqual(snapshotPayloadReceived.currentTrack, incomingTrack);
    assert.equal(snapshotPayloadReceived.currentTime, 45000);
    assert.equal(snapshotPayloadReceived.isPlaying, true);
  });

  it('4. guest_sync keeps guests in sync with host play/pause/seek', async () => {
    const store = useJamStore.getState();
    const roomId = 'test-guest-sync-room';

    useJamStore.setState({
      currentRoom: { id: roomId, roomId, name: 'Sync Room', hostId: 'host-1', isPlaying: false },
    });

    let syncData = null;
    store.registerAudioSyncHandlers({
      onGuestSync: (data) => {
        syncData = data;
      },
    });

    store.connectSocket(roomId, 'guest-user-456');

    const syncedTrack = { id: 't2', videoId: 'xyz789', title: 'Neon Horizon' };
    jamSocket.emit('guest_sync', {
      type: 'guest_sync',
      roomId,
      payload: {
        currentTrack: syncedTrack,
        currentTime: 92000,
        isPlaying: true,
      },
    });

    assert.ok(syncData);
    assert.deepEqual(syncData.currentTrack, syncedTrack);
    assert.equal(syncData.currentTime, 92000);
    assert.equal(syncData.isPlaying, true);

    const room = useJamStore.getState().currentRoom;
    assert.equal(room.state, 'playing');
    assert.deepEqual(room.currentTrack, syncedTrack);
  });

  it('5. host_left automatically disconnects guests and shows a toast', async () => {
    const store = useJamStore.getState();
    const roomId = 'test-host-left-room';

    useJamStore.setState({
      currentRoom: { id: roomId, roomId, name: 'Ending Jam', hostId: 'host-99' },
    });

    store.connectSocket(roomId, 'guest-listener-1');
    assert.ok(useJamStore.getState().currentRoom);

    // Simulate host_left event
    jamSocket.emit('host_left', {
      type: 'host_left',
      roomId,
    });

    // Verify room is cleared
    assert.equal(useJamStore.getState().currentRoom, null);

    // Verify toast message is shown
    const toast = useUiStore.getState().toastMessage;
    assert.equal(toast, 'The host ended the Jam');
  });
});
