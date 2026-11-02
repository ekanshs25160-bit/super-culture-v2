import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/db.js';
import { socketService } from '../services/socketService.js';
// In-memory active room cache for ultra low-latency playback synchronization (<15ms)
const activeRooms = new Map();
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
export class JamController {
    /**
     * Create a new Jam Room (adapted from Aurevon pattern)
     * POST /api/jam/create
     */
    async createRoom(req, res) {
        try {
            const guestId = req.headers['x-guest-id'] || req.body.userId || 'host-user';
            const { name, isPrivate = false } = req.body;
            if (!name) {
                res.status(400).json({ error: 'Room name is required' });
                return;
            }
            const roomId = uuidv4();
            const roomCode = generateRoomCode();
            const now = new Date().toISOString();
            const hostParticipant = {
                uid: guestId,
                name: name || 'Host',
                joinedAt: now,
                lastSeen: now,
            };
            const roomData = {
                roomId,
                roomCode,
                name,
                hostId: guestId,
                isPrivate: Boolean(isPrivate),
                state: 'waiting',
                queue: [],
                currentTrackIndex: 0,
                seekPosition: 0,
                startedAt: null,
                lastActive: now,
                participants: [hostParticipant],
                voteCount: 0,
                voteRoundId: 1,
            };
            // Store in memory for instant socket lookup
            activeRooms.set(roomId, roomData);
            // Persist to SQLite
            const db = getDatabase();
            const stmt = db.prepare(`
        INSERT INTO jam_rooms (
          room_id, room_code, name, host_id, is_private, state,
          current_track_index, seek_position, queue_json, participants_json,
          vote_count, vote_round_id, last_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
            stmt.run(roomId, roomCode, name, guestId, isPrivate ? 1 : 0, roomData.state, roomData.currentTrackIndex, roomData.seekPosition, JSON.stringify(roomData.queue), JSON.stringify(roomData.participants), roomData.voteCount, roomData.voteRoundId);
            console.log(`[Jam] Created Room "${name}" [${roomCode}] (ID: ${roomId})`);
            res.status(201).json({
                message: 'Room created successfully',
                roomId,
                roomCode,
                room: roomData,
            });
        }
        catch (error) {
            console.error('[JamController] createRoom error:', error);
            res.status(500).json({ error: 'Failed to create room', details: error.message });
        }
    }
    /**
     * Join an existing Jam Room by 6-char code
     * POST /api/jam/join
     */
    async joinRoom(req, res) {
        try {
            const guestId = req.headers['x-guest-id'] || req.body.userId || 'listener-user';
            const { roomCode: rawCode, name = 'Guest' } = req.body;
            const roomCode = (rawCode || '').trim().toUpperCase();
            if (!roomCode || roomCode.length < 4) {
                res.status(400).json({ error: 'Invalid room code provided' });
                return;
            }
            // 1. Look in active in-memory rooms
            let targetRoom;
            for (const room of activeRooms.values()) {
                if (room.roomCode === roomCode) {
                    targetRoom = room;
                    break;
                }
            }
            // 2. Fallback to SQLite lookup
            if (!targetRoom) {
                const db = getDatabase();
                const row = db.prepare('SELECT * FROM jam_rooms WHERE room_code = ?').get(roomCode);
                if (row) {
                    targetRoom = {
                        roomId: row.room_id,
                        roomCode: row.room_code,
                        name: row.name,
                        hostId: row.host_id,
                        isPrivate: Boolean(row.is_private),
                        state: row.state,
                        queue: JSON.parse(row.queue_json || '[]'),
                        currentTrackIndex: row.current_track_index,
                        seekPosition: row.seek_position,
                        lastActive: row.last_active,
                        participants: JSON.parse(row.participants_json || '[]'),
                        voteCount: row.vote_count,
                        voteRoundId: row.vote_round_id,
                    };
                    activeRooms.set(targetRoom.roomId, targetRoom);
                }
            }
            if (!targetRoom) {
                res.status(404).json({ error: `Room with code "${roomCode}" not found` });
                return;
            }
            // Update or add participant
            const now = new Date().toISOString();
            const existing = targetRoom.participants.find((p) => p.uid === guestId);
            if (existing) {
                existing.lastSeen = now;
                existing.name = name;
            }
            else {
                targetRoom.participants.push({
                    uid: guestId,
                    name,
                    joinedAt: now,
                    lastSeen: now,
                });
            }
            targetRoom.lastActive = now;
            activeRooms.set(targetRoom.roomId, targetRoom);
            res.json({
                message: 'Joined room successfully',
                roomId: targetRoom.roomId,
                roomCode: targetRoom.roomCode,
                room: targetRoom,
            });
        }
        catch (error) {
            console.error('[JamController] joinRoom error:', error);
            res.status(500).json({ error: 'Failed to join room', details: error.message });
        }
    }
    /**
     * Get active public rooms for Live Jam Rooms sidebar card
     * GET /api/jam/active/public
     */
    async getActivePublicRooms(req, res) {
        try {
            const publicRooms = [];
            for (const room of activeRooms.values()) {
                if (!room.isPrivate && room.state !== 'ended') {
                    publicRooms.push({
                        roomId: room.roomId,
                        roomCode: room.roomCode,
                        name: room.name,
                        hostId: room.hostId,
                        listeners: room.participants.length,
                        state: room.state,
                        currentTrack: room.queue[room.currentTrackIndex] || null,
                    });
                }
            }
            // If empty in RAM, query SQLite active records
            if (publicRooms.length === 0) {
                const db = getDatabase();
                const rows = db.prepare(`
          SELECT room_id, room_code, name, host_id, state, queue_json, participants_json
          FROM jam_rooms
          WHERE is_private = 0 AND state != 'ended'
          ORDER BY last_active DESC
          LIMIT 10
        `).all();
                for (const r of rows) {
                    const queue = JSON.parse(r.queue_json || '[]');
                    const participants = JSON.parse(r.participants_json || '[]');
                    publicRooms.push({
                        roomId: r.room_id,
                        roomCode: r.room_code,
                        name: r.name,
                        hostId: r.host_id,
                        listeners: participants.length,
                        state: r.state,
                        currentTrack: queue[0] || null,
                    });
                }
            }
            res.json({ rooms: publicRooms });
        }
        catch (error) {
            console.error('[JamController] getActivePublicRooms error:', error);
            res.status(500).json({ error: 'Failed to fetch public rooms' });
        }
    }
    /**
     * Append a song to the room queue
     * POST /api/jam/:roomId/queue
     */
    async addToQueue(req, res) {
        try {
            const { roomId } = req.params;
            const { song, playImmediately = false } = req.body;
            const guestId = req.headers['x-guest-id'] || 'guest';
            const room = activeRooms.get(roomId);
            if (!room) {
                res.status(404).json({ error: 'Room not found' });
                return;
            }
            const newSong = {
                ...song,
                addedBy: guestId,
                addedAt: new Date().toISOString(),
            };
            room.queue.push(newSong);
            if ((room.state === 'waiting' && room.queue.length === 1) || playImmediately) {
                room.state = 'playing';
                room.currentTrackIndex = room.queue.length - 1;
                room.seekPosition = 0;
                room.startedAt = new Date().toISOString();
            }
            room.lastActive = new Date().toISOString();
            activeRooms.set(roomId, room);
            // Broadcast update to all room listeners via WebSocket
            socketService.broadcastToRoom(roomId, {
                type: 'ADD_QUEUE',
                roomId,
                payload: { queue: room.queue, state: room.state, currentTrackIndex: room.currentTrackIndex },
                timestamp: Date.now(),
            });
            res.json({ message: 'Song added to queue', room });
        }
        catch (error) {
            console.error('[JamController] addToQueue error:', error);
            res.status(500).json({ error: 'Failed to add song to queue' });
        }
    }
    /**
     * Heartbeat to keep listener active status updated
     * POST /api/jam/:roomId/heartbeat
     */
    async heartbeat(req, res) {
        const { roomId } = req.params;
        const guestId = req.headers['x-guest-id'];
        const room = activeRooms.get(roomId);
        if (room && guestId) {
            const p = room.participants.find((u) => u.uid === guestId);
            if (p) {
                p.lastSeen = new Date().toISOString();
                room.lastActive = new Date().toISOString();
            }
        }
        res.json({ status: 'ok' });
    }
}
export const jamController = new JamController();
//# sourceMappingURL=jamController.js.map