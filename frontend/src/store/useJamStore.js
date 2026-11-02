import { create } from 'zustand';
import { apiClient, getGuestId } from '../services/api';
import { jamSocket } from '../services/jamSocket';

export const useJamStore = create((set, get) => ({
  activeRooms: [],
  currentRoom: null,
  socketConnected: false,
  loading: false,
  error: null,
  externalAudioSyncHandlers: null,

  /**
   * Set callback handlers to sync audio playback to the existing AudioContext
   */
  registerAudioSyncHandlers: (handlers) => {
    set({ externalAudioSyncHandlers: handlers });
  },

  /**
   * Fetch public active rooms from backend
   */
  fetchActiveRooms: async () => {
    try {
      const res = await apiClient.jam.getActiveRooms();
      const rooms = Array.isArray(res) ? res : res?.rooms || [];
      set({ activeRooms: rooms, error: null });
    } catch (err) {
      console.warn('[JamStore] Failed to fetch live rooms:', err.message);
      set({ activeRooms: [], error: err.message });
    }
  },

  /**
   * Join a room via REST + WebSocket
   */
  joinRoom: async (roomId, guestName = 'Super Culture Member') => {
    const guestId = getGuestId();
    set({ loading: true });

    try {
      const res = await apiClient.jam.joinRoom(roomId, guestName);
      const roomData = res.room || res;

      set({
        currentRoom: roomData,
        loading: false,
      });

      // Connect socket & register message listeners
      get().connectSocket(roomId, guestId);
      return roomData;
    } catch (err) {
      console.warn('[JamStore] REST Join room failed, using local room state:', err);
      const fallback = {
        id: roomId,
        name: 'Live Jam',
        hostId: 'host-user',
        participants: [{ uid: guestId, name: guestName, joinedAt: new Date().toISOString() }],
        queue: [],
      };
      set({ currentRoom: fallback, loading: false });
      get().connectSocket(roomId, guestId);
      return fallback;
    }
  },

  /**
   * Leave current room and disconnect socket
   */
  leaveRoom: () => {
    get().disconnectSocket();
    set({ currentRoom: null });
  },

  /**
   * Create a new room
   */
  createRoom: async (name, isPrivate = false) => {
    const guestId = getGuestId();
    try {
      const res = await apiClient.jam.createRoom(name, isPrivate);
      const room = res.room || res;
      set((state) => ({
        activeRooms: [room, ...state.activeRooms],
        currentRoom: room,
      }));
      get().connectSocket(room.roomId || room.id, guestId);
      return room;
    } catch (err) {
      console.error('[JamStore] Failed to create room:', err);
      return null;
    }
  },

  /**
   * Connect WebSocket and bind room synchronization events
   */
  connectSocket: (roomId, userId) => {
    jamSocket.connect(roomId, userId);

    // Connection status listener
    jamSocket.on('connection_status', ({ connected }) => {
      set({ socketConnected: connected });
    });

    // Remote playback synchronization listeners (Host -> Guests)
    jamSocket.on('PLAY', (msg) => {
      const handlers = get().externalAudioSyncHandlers;
      if (handlers?.onRemotePlay) {
        handlers.onRemotePlay(msg.payload?.currentTime);
      }
    });

    jamSocket.on('PAUSE', (msg) => {
      const handlers = get().externalAudioSyncHandlers;
      if (handlers?.onRemotePause) {
        handlers.onRemotePause(msg.payload?.currentTime);
      }
    });

    jamSocket.on('SEEK', (msg) => {
      const handlers = get().externalAudioSyncHandlers;
      if (handlers?.onRemoteSeek) {
        handlers.onRemoteSeek(msg.payload?.position);
      }
    });

    jamSocket.on('TRACK_CHANGE', (msg) => {
      const handlers = get().externalAudioSyncHandlers;
      if (handlers?.onRemoteTrackChange && msg.payload?.track) {
        handlers.onRemoteTrackChange(msg.payload.track);
      }
    });

    jamSocket.on('ADD_QUEUE', (msg) => {
      const room = get().currentRoom;
      if (room && msg.payload?.queue) {
        set({
          currentRoom: {
            ...room,
            queue: msg.payload.queue,
            state: msg.payload.state || room.state,
          },
        });
      }
    });

    jamSocket.on('USER_JOINED', (msg) => {
      const room = get().currentRoom;
      if (room && msg.payload?.clientCount) {
        set({
          currentRoom: {
            ...room,
            participantsCount: msg.payload.clientCount,
          },
        });
      }
    });

    jamSocket.on('USER_LEFT', (msg) => {
      const room = get().currentRoom;
      if (room && msg.payload?.clientCount) {
        set({
          currentRoom: {
            ...room,
            participantsCount: msg.payload.clientCount,
          },
        });
      }
    });
  },

  disconnectSocket: () => {
    jamSocket.disconnect();
    set({ socketConnected: false });
  },

  /**
   * Append a song to the live shared room queue
   */
  addToQueue: async (roomId, song, playImmediately = false) => {
    try {
      const res = await apiClient.jam.addToQueue(roomId, song, playImmediately);
      if (res.room) {
        set({ currentRoom: res.room });
      }
      return res;
    } catch (e) {
      console.warn('[JamStore] REST addToQueue error, broadcasting socket fallback:', e);
      jamSocket.send({
        type: 'ADD_QUEUE',
        roomId,
        payload: { track: song },
      });
    }
  },

  /**
   * Broadcast Host playback controls
   */
  broadcastPlay: (currentTime) => {
    const room = get().currentRoom;
    if (!room) return;
    jamSocket.send({
      type: 'PLAY',
      roomId: room.roomId || room.id,
      payload: { currentTime },
    });
  },

  broadcastPause: (currentTime) => {
    const room = get().currentRoom;
    if (!room) return;
    jamSocket.send({
      type: 'PAUSE',
      roomId: room.roomId || room.id,
      payload: { currentTime },
    });
  },

  broadcastSeek: (position) => {
    const room = get().currentRoom;
    if (!room) return;
    jamSocket.send({
      type: 'SEEK',
      roomId: room.roomId || room.id,
      payload: { position },
    });
  },

  broadcastTrackChange: (track) => {
    const room = get().currentRoom;
    if (!room) return;
    jamSocket.send({
      type: 'TRACK_CHANGE',
      roomId: room.roomId || room.id,
      payload: { track },
    });
  },

  broadcastVoteSkip: () => {
    const room = get().currentRoom;
    if (!room) return;
    jamSocket.send({
      type: 'VOTE_SKIP',
      roomId: room.roomId || room.id,
    });
  },

  sendHeartbeat: async (roomId) => {
    try {
      await apiClient.jam.sendHeartbeat(roomId);
    } catch (e) {
      console.warn('Heartbeat error:', e);
    }
  },
}));
