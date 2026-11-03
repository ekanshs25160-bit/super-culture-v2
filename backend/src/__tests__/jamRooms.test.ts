import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { SocketService, activeRooms } from '../services/socketService.js';

describe('Jam Rooms & WebSocket Hardening Suite', () => {
  let server: any;
  let socketService: SocketService;
  let port: number;

  before(async () => {
    server = createServer();
    socketService = new SocketService();
    socketService.initialize(server);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 5001;
        resolve();
      });
    });
  });

  after(async () => {
    activeRooms.clear();
    await socketService.close();
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    setTimeout(() => process.exit(0), 50);
  });

  const createClient = (): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/jam`);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  };

  const waitForMessage = (ws: WebSocket, timeout = 3000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message after ${timeout}ms`));
      }, timeout);

      const handler = (data: Buffer) => {
        clearTimeout(timer);
        ws.off('message', handler);
        try {
          resolve(JSON.parse(data.toString()));
        } catch (e) {
          reject(e);
        }
      };

      ws.on('message', handler);
    });
  };

  it('1. create_room initializes room in activeRooms with hostId', async () => {
    const ws = await createClient();
    const roomId = 'test-room-create-1';
    const hostId = 'test-host-uuid-1';

    ws.send(JSON.stringify({
      type: 'create_room',
      roomId,
      hostId,
    }));

    // Wait a brief moment for processing
    await new Promise((r) => setTimeout(r, 50));

    assert.ok(activeRooms.has(roomId), 'activeRooms must contain created roomId');
    const room = activeRooms.get(roomId)!;
    assert.equal(room.hostId, hostId);
    assert.equal(room.isPlaying, false);
    assert.equal(room.currentTime, 0);
    assert.ok(room.updatedAt > 0);

    ws.close();
  });

  it('2. join_room returns room_snapshot to late joiner with calculated elapsed time', async () => {
    const roomId = 'test-room-snapshot-2';
    const hostId = 'host-sync-user-2';
    const sampleTrack = { id: 'track-abc', videoId: 'abc1234', title: 'Midnight City' };
    const initialTime = 42;
    const elapsedLag = 80;

    // Pre-populate room playing state
    activeRooms.set(roomId, {
      hostId,
      currentTrack: sampleTrack,
      currentTime: initialTime,
      isPlaying: true,
      updatedAt: Date.now() - elapsedLag,
    });

    const guestWs = await createClient();
    const snapshotPromise = waitForMessage(guestWs, 2000);

    guestWs.send(JSON.stringify({
      type: 'join_room',
      roomId,
      userId: 'late-guest-user-99',
    }));

    const snapshotMsg = await snapshotPromise;

    assert.ok(snapshotMsg, 'Expected room_snapshot event upon joining');
    assert.equal(snapshotMsg.type, 'room_snapshot');
    assert.deepEqual(snapshotMsg.payload.currentTrack, sampleTrack);
    assert.equal(snapshotMsg.payload.isPlaying, true);
    // Calculated currentTime = storedTime + (Date.now() - updatedAt)
    assert.ok(
      snapshotMsg.payload.currentTime >= initialTime + elapsedLag,
      `Calculated time ${snapshotMsg.payload.currentTime} should account for elapsed ms`
    );

    guestWs.close();
  });

  it('3. host_sync enforces host privileges, updates state in Map, and broadcasts guest_sync', async () => {
    const roomId = 'test-room-sync-3';
    const hostId = 'legit-host-3';
    const unauthorizedId = 'unauthorized-user-3';

    // Host establishes room
    const hostWs = await createClient();
    hostWs.send(JSON.stringify({
      type: 'create_room',
      roomId,
      hostId,
    }));
    await new Promise((r) => setTimeout(r, 50));

    // Guest joins room
    const guestWs = await createClient();
    guestWs.send(JSON.stringify({
      type: 'join_room',
      roomId,
      userId: 'guest-member-3',
    }));
    await new Promise((r) => setTimeout(r, 50));

    // Unauthorized user attempts host_sync
    const imposterWs = await createClient();
    imposterWs.send(JSON.stringify({
      type: 'host_sync',
      roomId,
      hostId: unauthorizedId,
      currentTime: 100,
      isPlaying: true,
    }));

    const errorMsg = await waitForMessage(imposterWs);
    assert.equal(errorMsg.type, 'ERROR');

    // Legitimate host performs host_sync
    const newTrack = { id: 'new-track', title: 'Solar Power' };
    const syncTime = 12500;

    hostWs.send(JSON.stringify({
      type: 'host_sync',
      roomId,
      hostId,
      currentTrack: newTrack,
      currentTime: syncTime,
      isPlaying: true,
    }));

    // Guest receives guest_sync
    let guestSyncMsg: any = null;
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && !guestSyncMsg) {
      const msg = await waitForMessage(guestWs, 1000);
      if (msg.type === 'guest_sync') {
        guestSyncMsg = msg;
        break;
      }
    }

    assert.ok(guestSyncMsg, 'Guest must receive guest_sync event');
    assert.deepEqual(guestSyncMsg.payload.currentTrack, newTrack);
    assert.equal(guestSyncMsg.payload.currentTime, syncTime);
    assert.equal(guestSyncMsg.payload.isPlaying, true);

    // Verify room in activeRooms Map was updated
    const updatedRoom = activeRooms.get(roomId)!;
    assert.deepEqual(updatedRoom.currentTrack, newTrack);
    assert.equal(updatedRoom.currentTime, syncTime);
    assert.equal(updatedRoom.isPlaying, true);

    hostWs.close();
    guestWs.close();
    imposterWs.close();
  });

  it('4. host disconnect broadcasts host_left and removes room from activeRooms', async () => {
    const roomId = 'test-room-disconnect-4';
    const hostId = 'disconnecting-host-4';

    const hostWs = await createClient();
    hostWs.send(JSON.stringify({
      type: 'create_room',
      roomId,
      hostId,
    }));
    await new Promise((r) => setTimeout(r, 50));

    assert.ok(activeRooms.has(roomId));

    const guestWs = await createClient();
    guestWs.send(JSON.stringify({
      type: 'join_room',
      roomId,
      userId: 'guest-user-4',
    }));
    await new Promise((r) => setTimeout(r, 50));

    // Host disconnects
    hostWs.close();

    // Guest should receive host_left
    let hostLeftMsg: any = null;
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && !hostLeftMsg) {
      const msg = await waitForMessage(guestWs, 1000);
      if (msg.type === 'host_left') {
        hostLeftMsg = msg;
        break;
      }
    }

    assert.ok(hostLeftMsg, 'Guest must receive host_left upon host disconnection');
    assert.equal(hostLeftMsg.roomId, roomId);
    assert.equal(activeRooms.has(roomId), false, 'Room should be deleted from activeRooms');

    guestWs.close();
  });
});
