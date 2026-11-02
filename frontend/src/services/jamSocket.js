/**
 * Reconnecting WebSocket Client for Super Culture Jam Sync Engine.
 * Connects to /ws/jam on Express server, maintains a 15-second heartbeat interval,
 * and broadcasts/receives real-time playback actions.
 */

class JamSocketClient {
  constructor() {
    this.ws = null;
    this.roomId = null;
    this.userId = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.isExplicitlyClosed = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  getWsUrl() {
    if (typeof window === 'undefined') return 'ws://localhost:5001/ws/jam';
    const isHttps = window.location.protocol === 'https:';
    const host = window.location.host;
    return `${isHttps ? 'wss:' : 'ws:'}//${host}/ws/jam`;
  }

  connect(roomId, userId) {
    this.roomId = roomId;
    this.userId = userId;
    this.isExplicitlyClosed = false;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      // Re-issue JOIN if already connected
      this.send({ type: 'JOIN', roomId, userId });
      return;
    }

    try {
      const url = this.getWsUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit('connection_status', { connected: true });
        this.send({ type: 'JOIN', roomId: this.roomId, userId: this.userId });
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type) {
            this.emit(message.type, message);
          }
        } catch (e) {
          console.warn('[JamSocket] Failed to parse socket message:', e);
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.emit('connection_status', { connected: false });
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[JamSocket] Connection error:', err);
        this.emit('error', err);
      };
    } catch (e) {
      console.warn('[JamSocket] WebSocket initialization failed:', e);
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        console.warn('Error closing socket:', e);
      }
      this.ws = null;
    }
    this.emit('connection_status', { connected: false });
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.isExplicitlyClosed) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[JamSocket] Max reconnect attempts reached');
      return;
    }

    const backoff = Math.min(10000, 1000 * Math.pow(1.5, this.reconnectAttempts));
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isExplicitlyClosed && this.roomId) {
        this.connect(this.roomId, this.userId);
      }
    }, backoff);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.roomId) {
        this.send({
          type: 'HEARTBEAT',
          roomId: this.roomId,
          userId: this.userId,
          timestamp: Date.now(),
        });
      }
    }, 15000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...data,
        timestamp: Date.now(),
      }));
    }
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(handler);
    }
  }

  emit(event, payload) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        try {
          fn(payload);
        } catch (e) {
          console.error(`[JamSocket] Error in listener for ${event}:`, e);
        }
      }
    }
  }
}

export const jamSocket = new JamSocketClient();
