import { WebSocketServer, WebSocket } from 'ws';
export class SocketService {
    wss = null;
    // RoomId -> Set of active WebSockets
    roomClients = new Map();
    // WebSocket -> RoomId
    clientRooms = new Map();
    // WebSocket -> UserId
    clientUsers = new Map();
    initialize(server) {
        this.wss = new WebSocketServer({ server, path: '/ws/jam' });
        this.wss.on('connection', (ws, req) => {
            console.log(`[WebSocket] New Jam connection from ${req.socket.remoteAddress}`);
            ws.on('message', (raw) => {
                try {
                    const message = JSON.parse(raw.toString());
                    this.handleMessage(ws, message);
                }
                catch (error) {
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
    handleMessage(ws, msg) {
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
    joinRoom(ws, roomId, userId) {
        if (!this.roomClients.has(roomId)) {
            this.roomClients.set(roomId, new Set());
        }
        this.roomClients.get(roomId).add(ws);
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
    broadcastToRoom(roomId, message, sender) {
        const clients = this.roomClients.get(roomId);
        if (!clients)
            return;
        const data = JSON.stringify(message);
        for (const client of clients) {
            if (client.readyState === WebSocket.OPEN && client !== sender) {
                client.send(data);
            }
        }
    }
    sendToClient(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    handleDisconnect(ws) {
        const roomId = this.clientRooms.get(ws);
        const userId = this.clientUsers.get(ws);
        if (roomId && this.roomClients.has(roomId)) {
            const room = this.roomClients.get(roomId);
            room.delete(ws);
            if (room.size === 0) {
                this.roomClients.delete(roomId);
            }
            else {
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
    getRoomClientCount(roomId) {
        return this.roomClients.get(roomId)?.size || 0;
    }
}
export const socketService = new SocketService();
//# sourceMappingURL=socketService.js.map