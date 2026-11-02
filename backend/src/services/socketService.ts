import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'node:http';
import { JamSocketMessage } from '../types/index.js';

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

  private handleMessage(ws: WebSocket, msg: JamSocketMessage): void {
    const { type, roomId, userId, payload } = msg;

    switch (type) {
      case 'JOIN': {
        this.joinRoom(ws, roomId, userId);
        break;
      }
      case 'PLAY':
      case 'PAUSE':
      case 'SEEK':
      case 'TRACK_CHANGE':
      case 'ADD_QUEUE':
      case 'VOTE_SKIP': {
        // Broadcast state change across room with server-synchronized timestamp
        this.broadcastToRoom(roomId, {
          ...msg,
          timestamp: Date.now(),
        }, ws);
        break;
      }
      case 'HEARTBEAT': {
        this.sendToClient(ws, {
          type: 'HEARTBEAT',
          roomId,
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
    });
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
