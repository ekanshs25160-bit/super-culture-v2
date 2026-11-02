import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'node:http';
import { JamSocketMessage } from '../types/index.js';
export declare class SocketService {
    private wss;
    private roomClients;
    private clientRooms;
    private clientUsers;
    initialize(server: HttpServer): WebSocketServer;
    private handleMessage;
    joinRoom(ws: WebSocket, roomId: string, userId?: string): void;
    broadcastToRoom(roomId: string, message: JamSocketMessage, sender?: WebSocket): void;
    sendToClient(ws: WebSocket, message: JamSocketMessage): void;
    private handleDisconnect;
    getRoomClientCount(roomId: string): number;
}
export declare const socketService: SocketService;
