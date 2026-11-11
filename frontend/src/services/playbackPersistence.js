/**
 * Service for local playback state persistence.
 * Serializes and deserializes the critical player state (queue, current track, volume, currentTime, etc.)
 */

const STORAGE_KEY = 'superculture_playback_state';

const defaultState = {
  currentTrack: null,
  queue: [],
  volume: 0.74,
  currentTime: 0,
  isShuffle: false,
  isRepeat: false,
  repeatMode: 'off',
};

const playbackPersistence = {
  save(state) {
    try {
      const data = {
        currentTrack: state.currentTrack,
        queue: state.queue,
        volume: typeof state.volume === 'number' ? state.volume : 0.74,
        currentTime: typeof state.currentTime === 'number' ? state.currentTime : (state.progress || 0),
        isShuffle: Boolean(state.isShuffle),
        isRepeat: Boolean(state.isRepeat),
        repeatMode: state.repeatMode || (state.isRepeat ? 'all' : 'off'),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[Persistence] Failed to save playback state:', e);
    }
  },

  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return defaultState;

      const parsed = JSON.parse(saved);
      return {
        ...defaultState,
        ...parsed,
        queue: Array.isArray(parsed.queue) ? parsed.queue : [],
        currentTime: typeof parsed.currentTime === 'number' ? parsed.currentTime : (parsed.progress || 0),
        repeatMode: parsed.repeatMode || (parsed.isRepeat ? 'all' : 'off'),
      };
    } catch (e) {
      console.warn('[Persistence] Failed to load playback state:', e);
      return defaultState;
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};

export default playbackPersistence;

