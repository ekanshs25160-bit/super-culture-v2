import { create } from 'zustand';
import { apiClient } from '../services/api.js';
import { jamSocket } from '../services/jamSocket.js';
import { useUiStore } from './useUiStore.js';

const USER_ID_KEY = 'sc_user_id';

/**
 * Retrieves the persistent Jam user ID from localStorage or creates a random UUID.
 */
export const getStoredUserId = () => {
  if (typeof window === 'undefined') return 'sc-server-user';
  let uid = localStorage.getItem(USER_ID_KEY);
  if (!uid) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      uid = crypto.randomUUID();
    } else {
      uid = `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
    localStorage.setItem(USER_ID_KEY, uid);
  }
  return uid;
};

export const useJamStore = create((set, get) => ({
  userId: getStoredUserId(),
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
    const userId = get().userId || getStoredUserId();
    set({ loading: true });

    try {
      const res = await apiClient.jam.joinRoom(roomId, guestName);
      const roomData = res.room || res;

      set({
        currentRoom: roomData,
        loading: false,
      });

      // Connect socket & register message listeners
      get().connectSocket(roomId, userId);
      jamSocket.send({
        type: 'join_room',
        roomId,
        userId,
        payload: { roomId, userId },
      });
      return roomData;
    } catch (err) {
      console.warn('[JamStore] REST Join room failed, using local room state:', err);
      const fallback = {
        id: roomId,
        roomId,
        name: 'Live Jam',
        hostId: 'host-user',
        participants: [{ uid: userId, name: guestName, joinedAt: new Date().toISOString() }],
        queue: [],
      };
      set({ currentRoom: fallback, loading: false });
      get().connectSocket(roomId, userId);
      jamSocket.send({
        type: 'join_room',
        roomId,
        userId,
        payload: { roomId, userId },
      });
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
   * Create a new room with persistent userId as hostId
   */
  createRoom: async (name = 'Live Jam', isPrivate = false) => {
    const userId = get().userId || getStoredUserId();
    try {
      const res = await apiClient.jam.createRoom(name, isPrivate);
      const room = res.room || res;
      if (room) {
        room.hostId = userId;
      }
      set((state) => ({
        activeRooms: [room, ...state.activeRooms],
        currentRoom: room,
      }));
      const roomId = room.roomId || room.id;
      get().connectSocket(roomId, userId);
      jamSocket.send({
        type: 'create_room',
        roomId,
        hostId: userId,
        payload: { roomId, hostId: userId },
      });
      return room;
    } catch (err) {
      console.error('[JamStore] Failed to create room:', err);
      const roomId = `room-${Date.now()}`;
      const fallback = {
        id: roomId,
        roomId,
        name: name || 'Live Jam',
        hostId: userId,
        participants: [{ uid: userId, name: name || 'Host', joinedAt: new Date().toISOString() }],
        queue: [],
      };
      set((state) => ({
        activeRooms: [fallback, ...state.activeRooms],
        currentRoom: fallback,
      }));
      get().connectSocket(roomId, userId);
      jamSocket.send({
        type: 'create_room',
        roomId,
        hostId: userId,
        payload: { roomId, hostId: userId },
      });
      return fallback;
    }
  },

  /**
   * Alias for createRoom to satisfy createJamRoom naming convention
   */
  createJamRoom: async (name = 'Live Jam', isPrivate = false) => {
    return get().createRoom(name, isPrivate);
  },

  /**
   * Connect WebSocket and bind room synchronization events
   */
  connectSocket: (roomId, userIdParam) => {
    const userId = userIdParam || get().userId || getStoredUserId();
    jamSocket.connect(roomId, userId);

    // Connection status listener
    jamSocket.on('connection_status', ({ connected }) => {
      set({ socketConnected: connected });
    });

    // Handle initial room snapshot on late join
    jamSocket.on('room_snapshot', (msg) => {
      const payload = msg.payload || msg;
      const currentTrack = payload.currentTrack;
      const currentTime = payload.currentTime;
      const isPlaying = Boolean(payload.isPlaying);
      const queue = payload.queue;

      const room = get().currentRoom;
      if (room) {
        set({
          currentRoom: {
            ...room,
            currentTrack: currentTrack !== undefined ? currentTrack : room.currentTrack,
            queue: Array.isArray(queue) ? queue : room.queue,
            state: isPlaying ? 'playing' : 'paused',
          },
        });
      }

      const handlers = get().externalAudioSyncHandlers;
      if (handlers) {
        if (handlers.onRoomSnapshot) {
          handlers.onRoomSnapshot({ currentTrack, currentTime, isPlaying, queue });
        } else {
          const seekSeconds = typeof currentTime === 'number'
            ? (currentTime > 1000 ? currentTime / 1000 : currentTime)
            : 0;

          if (currentTrack && handlers.onRemoteTrackChange) {
            handlers.onRemoteTrackChange(currentTrack, queue);
          }
          if (typeof seekSeconds === 'number' && handlers.onRemoteSeek) {
            setTimeout(() => {
              handlers.onRemoteSeek(seekSeconds);
              if (isPlaying && handlers.onRemotePlay) {
                handlers.onRemotePlay(seekSeconds);
              } else if (!isPlaying && handlers.onRemotePause) {
                handlers.onRemotePause(seekSeconds);
              }
            }, 100);
          }
        }
      }
    });

    // Handle host remote sync broadcast for guests
    jamSocket.on('guest_sync', (msg) => {
      const payload = msg.payload || msg;
      const currentTrack = payload.currentTrack;
      const currentTime = payload.currentTime;
      const isPlaying = Boolean(payload.isPlaying);

      const room = get().currentRoom;
      if (room) {
        set({
          currentRoom: {
            ...room,
            currentTrack: currentTrack !== undefined ? currentTrack : room.currentTrack,
            state: isPlaying ? 'playing' : 'paused',
          },
        });
      }

      const handlers = get().externalAudioSyncHandlers;
      if (handlers) {
        if (handlers.onGuestSync) {
          handlers.onGuestSync({ currentTrack, currentTime, isPlaying });
        } else {
          const seekSeconds = typeof currentTime === 'number'
            ? (currentTime > 1000 ? currentTime / 1000 : currentTime)
            : 0;

          if (currentTrack && handlers.onRemoteTrackChange) {
            handlers.onRemoteTrackChange(currentTrack);
          }
          if (typeof seekSeconds === 'number' && handlers.onRemoteSeek) {
            handlers.onRemoteSeek(seekSeconds);
          }
          if (isPlaying && handlers.onRemotePlay) {
            handlers.onRemotePlay(seekSeconds);
          } else if (!isPlaying && handlers.onRemotePause) {
            handlers.onRemotePause(seekSeconds);
          }
        }
      }
    });

    // Handle host ending jam session or disconnecting
    jamSocket.on('host_left', () => {
      useUiStore.getState().showToast('The host ended the Jam');
      get().leaveRoom();
    });

    // Legacy individual playback synchronization listeners (Host -> Guests)
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
   * Host-only sync broadcast method
   */
  hostSync: ({ currentTrack, currentTime, isPlaying }) => {
    const room = get().currentRoom;
    const userId = get().userId || getStoredUserId();
    if (!room || room.hostId !== userId) return;
    const roomId = room.roomId || room.id;

    jamSocket.send({
      type: 'host_sync',
      roomId,
      hostId: userId,
      currentTrack,
      currentTime,
      isPlaying,
      payload: {
        roomId,
        hostId: userId,
        currentTrack,
        currentTime,
        isPlaying,
      },
    });
  },

  /**
   * Broadcast Host playback controls
   */
  broadcastPlay: (currentTime) => {
    const room = get().currentRoom;
    if (!room) return;
    const roomId = room.roomId || room.id;
    jamSocket.send({
      type: 'PLAY',
      roomId,
      payload: { currentTime },
    });
    get().hostSync({
      currentTrack: room.currentTrack,
      currentTime,
      isPlaying: true,
    });
  },

  broadcastPause: (currentTime) => {
    const room = get().currentRoom;
    if (!room) return;
    const roomId = room.roomId || room.id;
    jamSocket.send({
      type: 'PAUSE',
      roomId,
      payload: { currentTime },
    });
    get().hostSync({
      currentTrack: room.currentTrack,
      currentTime,
      isPlaying: false,
    });
  },

  broadcastSeek: (position) => {
    const room = get().currentRoom;
    if (!room) return;
    const roomId = room.roomId || room.id;
    jamSocket.send({
      type: 'SEEK',
      roomId,
      payload: { position },
    });
    get().hostSync({
      currentTrack: room.currentTrack,
      currentTime: position,
      isPlaying: true,
    });
  },

  broadcastTrackChange: (track) => {
    const room = get().currentRoom;
    if (!room) return;
    const roomId = room.roomId || room.id;
    if (room) {
      set({ currentRoom: { ...room, currentTrack: track } });
    }
    jamSocket.send({
      type: 'TRACK_CHANGE',
      roomId,
      payload: { track },
    });
    get().hostSync({
      currentTrack: track,
      currentTime: 0,
      isPlaying: true,
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
