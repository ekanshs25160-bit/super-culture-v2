import { SqliteDatabase } from '../config/db.js';

export const SCHEMA_SQL = `
-- User Profile & Preferences
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Guest',
  avatar_url TEXT,
  mode TEXT NOT NULL DEFAULT 'public' CHECK (mode IN ('public', 'private')),
  mood TEXT NOT NULL DEFAULT 'energetic' CHECK (mood IN ('energetic', 'chill', 'melancholy', 'focus')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Liked Tracks
CREATE TABLE IF NOT EXISTS liked_songs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, video_id)
);

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Playlist Tracks
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

-- User Play History (Recents)
CREATE TABLE IF NOT EXISTS play_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER DEFAULT 0,
  played_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Jam Rooms (Persistent / Snapshot state)
CREATE TABLE IF NOT EXISTS jam_rooms (
  room_id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  host_id TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'waiting',
  current_track_index INTEGER NOT NULL DEFAULT 0,
  seek_position REAL NOT NULL DEFAULT 0,
  queue_json TEXT NOT NULL DEFAULT '[]',
  participants_json TEXT NOT NULL DEFAULT '[]',
  vote_count INTEGER NOT NULL DEFAULT 0,
  vote_round_id INTEGER NOT NULL DEFAULT 1,
  last_active DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User Taste Memories (for Memori AI DJ integration)
CREATE TABLE IF NOT EXISTS user_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'music_taste',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Primary Indices
CREATE INDEX IF NOT EXISTS idx_liked_user ON liked_songs(user_id);
CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_history_user ON play_history(user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_jam_code ON jam_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_memories_user ON user_memories(user_id);
`;

/**
 * Migration 002: Speed hardening indexes for user/guest id and video id lookups
 */
export const MIGRATION_INDEXES_SQL = `
-- Video ID and User/Guest ID Indexing Migration
CREATE INDEX IF NOT EXISTS idx_liked_video ON liked_songs(video_id);
CREATE INDEX IF NOT EXISTS idx_liked_user_video ON liked_songs(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_video ON playlist_tracks(video_id);
CREATE INDEX IF NOT EXISTS idx_history_video ON play_history(video_id);
CREATE INDEX IF NOT EXISTS idx_history_user_video ON play_history(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_jam_host ON jam_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_jam_active ON jam_rooms(is_private, state);
CREATE INDEX IF NOT EXISTS idx_memories_user_category ON user_memories(user_id, category);
`;

export function initializeSchema(db: SqliteDatabase): void {
  // Ensure WAL mode and synchronous = NORMAL
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(SCHEMA_SQL);
  db.exec(MIGRATION_INDEXES_SQL);
  console.log('[DB] SQLite WAL mode and performance indexes verified.');
}
