import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'node:http';
import { JamSocketMessage } from '../types/index.js';

// In-memory state of active rooms for host permissions & synchronization
export const activeRooms = new Map<
  string,
  {
    hostId: string;
    currentTrack: any;
    currentTime: number;
    isPlaying: boolean;
    updatedAt: number;
  }
>();

export class SocketService {
  private wss: WebSocketServer | null = null;
  // RoomId -> Set of active WebSockets
  private roomClients = new Map<string, Set<WebSocket>>();
  // WebSocket -> RoomId
  private clientRooms = new Map<WebSocket, string>();
  // WebSocket -> UserId
  private clientUsers = new Map<WebSocket, string>();

  public initialize(server: HttpServer): WebSocketServer {
    this.wss = new WebSocketServer({ server, path: '/ws/jam' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log(`[WebSocket] New Jam connection from ${req.socket.remoteAddress}`);

      ws.on('message', (raw: Buffer) => {
        try {
          const message: JamSocketMessage = JSON.parse(raw.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('[WebSocket] Malformed message received:', error);
          this.sendToClient(ws, {
            type: 'ERROR',
            roomId: '',
            payload: { message: 'Invalid JSON payload' },
            timestamp: Date.now(),
          });
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (err) => {
        console.error('[WebSocket] Socket error:', err.message);
      });
    });

    console.log('[WebSocket] Jam sync server initialized on path /ws/jam');
    return this.wss;
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        for (const client of this.wss.clients) {
          try {
            client.terminate();
          } catch {
            // ignore
          }
        }
        this.wss.close(() => {
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleMessage(ws: WebSocket, msg: JamSocketMessage): void {
    const type = msg.type;
    const roomId = msg.roomId || (msg.payload as any)?.roomId;
    const hostId = msg.hostId || (msg.payload as any)?.hostId || msg.userId || (msg.payload as any)?.userId;
    const userId = msg.userId || (msg.payload as any)?.userId || hostId;

    switch (type) {
      case 'create_room':
      case 'CREATE_ROOM': {
        if (roomId && hostId) {
          activeRooms.set(roomId, {
            hostId,
            currentTrack: (msg.payload as any)?.currentTrack || msg.currentTrack || null,
            currentTime: (msg.payload as any)?.currentTime ?? msg.currentTime ?? 0,
            isPlaying: Boolean((msg.payload as any)?.isPlaying ?? msg.isPlaying ?? false),
            updatedAt: Date.now(),
          });
          this.joinRoom(ws, roomId, hostId);
        }
        break;
      }

      case 'join_room':
      case 'JOIN': {
        if (roomId) {
          this.joinRoom(ws, roomId, userId);
        }
        break;
      }

      case 'host_sync':
      case 'HOST_SYNC': {
        if (!roomId || !hostId) return;

        const room = activeRooms.get(roomId);
        if (!room) {
          console.warn(`[WebSocket] host_sync received for non-existent room: ${roomId}`);
          return;
        }

        // Verify host privileges
        if (room.hostId !== hostId) {
          console.warn(`[WebSocket] Unauthorized host_sync attempt by ${hostId} on room ${roomId}`);
          this.sendToClient(ws, {
            type: 'ERROR',
            roomId,
            payload: { message: 'Unauthorized: Only the host can synchronize playback' },
            timestamp: Date.now(),
          });
          return;
        }

        const currentTrack = msg.currentTrack !== undefined ? msg.currentTrack : (msg.payload as any)?.currentTrack;
        const currentTime = typeof msg.currentTime === 'number' ? msg.currentTime : (msg.payload as any)?.currentTime;
        const isPlaying = msg.isPlaying !== undefined ? msg.isPlaying : (msg.payload as any)?.isPlaying;

        // Update room state in Map
        room.currentTrack = currentTrack !== undefined ? currentTrack : room.currentTrack;
        room.currentTime = typeof currentTime === 'number' ? currentTime : room.currentTime;
        room.isPlaying = Boolean(isPlaying);
        room.updatedAt = Date.now();
        activeRooms.set(roomId, room);

        // Broadcast guest_sync to all other users in the room
        const syncPayload = {
          roomId,
          hostId,
          currentTrack: room.currentTrack,
          currentTime: room.currentTime,
          isPlaying: room.isPlaying,
          updatedAt: room.updatedAt,
        };

        this.broadcastToRoom(
          roomId,
          {
            type: 'guest_sync',
            roomId,
            payload: syncPayload,
            currentTrack: room.currentTrack,
            currentTime: room.currentTime,
            isPlaying: room.isPlaying,
            timestamp: Date.now(),
          },
          ws
        );
        break;
      }

      case 'host_left':
      case 'HOST_LEFT': {
        if (roomId && hostId && activeRooms.get(roomId)?.hostId === hostId) {
          this.broadcastToRoom(
            roomId,
            {
              type: 'host_left',
              roomId,
              userId: hostId,
              payload: { message: 'The host ended the Jam', roomId, hostId },
              timestamp: Date.now(),
            },
            ws
          );
          activeRooms.delete(roomId);
        }
        break;
      }

      case 'PLAY':
      case 'PAUSE':
      case 'SEEK':
      case 'TRACK_CHANGE':
      case 'ADD_QUEUE':
      case 'VOTE_SKIP': {
        // Keep activeRooms in sync if host triggered legacy playback action
        if (roomId && activeRooms.has(roomId)) {
          const room = activeRooms.get(roomId)!;
          if (room.hostId === userId) {
            if (type === 'PLAY') {
              room.isPlaying = true;
              if (typeof (msg.payload as any)?.currentTime === 'number') {
                room.currentTime = (msg.payload as any).currentTime;
              }
              room.updatedAt = Date.now();
            } else if (type === 'PAUSE') {
              room.isPlaying = false;
              if (typeof (msg.payload as any)?.currentTime === 'number') {
                room.currentTime = (msg.payload as any).currentTime;
              }
              room.updatedAt = Date.now();
            } else if (type === 'SEEK' && typeof (msg.payload as any)?.position === 'number') {
              room.currentTime = (msg.payload as any).position;
              room.updatedAt = Date.now();
            } else if (type === 'TRACK_CHANGE' && (msg.payload as any)?.track) {
              room.currentTrack = (msg.payload as any).track;
              room.currentTime = 0;
              room.isPlaying = true;
              room.updatedAt = Date.now();
            }
            activeRooms.set(roomId, room);
          }
        }

        // Broadcast state change across room with server-synchronized timestamp
        this.broadcastToRoom(
          roomId,
          {
            ...msg,
            timestamp: Date.now(),
          },
          ws
        );
        break;
      }

      case 'HEARTBEAT': {
        this.sendToClient(ws, {
          type: 'HEARTBEAT',
          roomId: roomId || '',
          payload: { status: 'pong' },
          timestamp: Date.now(),
        });
        break;
      }

      default:
        console.warn(`[WebSocket] Unhandled socket action: ${type}`);
    }
  }

  public joinRoom(ws: WebSocket, roomId: string, userId?: string): void {
    if (!this.roomClients.has(roomId)) {
      this.roomClients.set(roomId, new Set());
    }

    this.roomClients.get(roomId)!.add(ws);
    this.clientRooms.set(ws, roomId);
    if (userId) {
      this.clientUsers.set(ws, userId);
    }

    console.log(`[WebSocket] User ${userId || 'anonymous'} joined Jam Room ${roomId}`);

    // Notify room members
    this.broadcastToRoom(roomId, {
      type: 'USER_JOINED',
      roomId,
      userId,
      payload: { userId, clientCount: this.getRoomClientCount(roomId) },
      timestamp: Date.now(),
    }, ws);

    // Check if room exists in activeRooms; if so, emit snapshot to the joining user
    const room = activeRooms.get(roomId);
    if (room) {
      const calculatedTime = room.isPlaying
        ? room.currentTime + (Date.now() - room.updatedAt)
        : room.currentTime;

      const snapshotPayload = {
        currentTrack: room.currentTrack,
        currentTime: calculatedTime,
        isPlaying: room.isPlaying,
      };

      this.sendToClient(ws, {
        type: 'room_snapshot',
        roomId,
        payload: snapshotPayload,
        currentTrack: room.currentTrack,
        currentTime: calculatedTime,
        isPlaying: room.isPlaying,
        timestamp: Date.now(),
      });
    }
  }

  public broadcastToRoom(roomId: string, message: JamSocketMessage, sender?: WebSocket): void {
    const clients = this.roomClients.get(roomId);
    if (!clients) return;

    const data = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN && client !== sender) {
        client.send(data);
      }
    }
  }

  public sendToClient(ws: WebSocket, message: JamSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private handleDisconnect(ws: WebSocket): void {
    const roomId = this.clientRooms.get(ws);
    const userId = this.clientUsers.get(ws);

    // If the disconnecting user is the hostId of a room, broadcast host_left and delete room from activeRooms
    if (userId) {
      for (const [rId, room] of activeRooms.entries()) {
        if (room.hostId === userId) {
          console.log(`[WebSocket] Host ${userId} disconnected from room ${rId}. Ending room.`);
          this.broadcastToRoom(
            rId,
            {
              type: 'host_left',
              roomId: rId,
              userId,
              payload: { message: 'The host ended the Jam', roomId: rId, hostId: userId },
              timestamp: Date.now(),
            },
            ws
          );
          activeRooms.delete(rId);
        }
      }
    }

    if (roomId && this.roomClients.has(roomId)) {
      const room = this.roomClients.get(roomId)!;
      room.delete(ws);

      if (room.size === 0) {
        this.roomClients.delete(roomId);
      } else {
        this.broadcastToRoom(roomId, {
          type: 'USER_LEFT',
          roomId,
          userId,
          payload: { userId, clientCount: room.size },
          timestamp: Date.now(),
        });
      }
    }

    this.clientRooms.delete(ws);
    this.clientUsers.delete(ws);
    console.log(`[WebSocket] Client disconnected from room ${roomId || 'none'}`);
  }

  public getRoomClientCount(roomId: string): number {
    return this.roomClients.get(roomId)?.size || 0;
  }
}

export const socketService = new SocketService();
