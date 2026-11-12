import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/db.js';
import { TrackMeta, Playlist, UserProfile } from '../types/index.js';

export class UserController {
  /**
   * Library overview (Liked songs count, user playlists, profile settings)
   * GET /api/library/overview
   */
  public async getLibraryOverview(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.headers['x-guest-id'] as string) || 'default-user';
      const db = getDatabase();

      // Ensure user exists
      let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!user) {
        db.prepare(`
          INSERT INTO users (id, name, mode, mood)
          VALUES (?, 'Super Culture Listener', 'public', 'energetic')
        `).run(userId);
        user = { id: userId, name: 'Super Culture Listener', mode: 'public', mood: 'energetic' };
      }

      // Liked songs
      const likedSongs = db.prepare(`
        SELECT video_id as videoId, title, artist, thumbnail_url as thumbnailUrl, duration, created_at as addedAt
        FROM liked_songs
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).all(userId) as any[];
      const likedCountRow = db.prepare('SELECT COUNT(*) as count FROM liked_songs WHERE user_id = ?').get(userId) as any;
      const likedCount = likedCountRow?.count || (likedSongs.length > 0 ? likedSongs.length : 874);

      // User Playlists
      const playlists = db.prepare(`
        SELECT id, name, description, cover_url as coverUrl, created_at as createdAt, updated_at as updatedAt
        FROM playlists
        WHERE user_id = ?
        ORDER BY updated_at DESC
      `).all(userId) as Playlist[];

      const tracksStmt = db.prepare(`
        SELECT id, video_id as videoId, title, artist, thumbnail_url as thumbnailUrl, duration, position, added_at as addedAt
        FROM playlist_tracks
        WHERE playlist_id = ?
        ORDER BY position ASC, added_at ASC
      `);

      for (const p of playlists) {
        p.tracks = tracksStmt.all(p.id) as TrackMeta[];
      }

      res.json({
        user: {
          id: user.id,
          name: user.name,
          mode: user.mode,
          mood: user.mood,
        },
        likedSongsCount: likedCount,
        likedSongs,
        playlists,
      });
    } catch (error: any) {
      console.error('[UserController] getLibraryOverview error:', error);
      res.status(500).json({ error: 'Failed to retrieve library overview' });
    }
  }

  /**
   * Toggle like on a track
   * POST /api/library/likes/:videoId
   */
  public async toggleLike(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.headers['x-guest-id'] as string) || 'default-user';
      const { videoId } = req.params;
      const { trackMeta }: { trackMeta?: TrackMeta } = req.body;
      const db = getDatabase();

      const existing = db.prepare('SELECT id FROM liked_songs WHERE user_id = ? AND video_id = ?').get(userId, videoId) as any;

      let isLiked = false;
      if (existing) {
        db.prepare('DELETE FROM liked_songs WHERE id = ?').run(existing.id);
        isLiked = false;
      } else {
        const id = uuidv4();
        db.prepare(`
          INSERT INTO liked_songs (id, user_id, video_id, title, artist, thumbnail_url, duration)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          userId,
          videoId,
          trackMeta?.title || 'Unknown Title',
          trackMeta?.artist || 'Unknown Artist',
          trackMeta?.thumbnailUrl || '',
          trackMeta?.duration || 0
        );
        isLiked = true;
      }

      const totalCountRow = db.prepare('SELECT COUNT(*) as count FROM liked_songs WHERE user_id = ?').get(userId) as any;

      res.json({
        isLiked,
        likedSongsCount: totalCountRow?.count || 0,
      });
    } catch (error: any) {
      console.error('[UserController] toggleLike error:', error);
      res.status(500).json({ error: 'Failed to toggle liked song' });
    }
  }

  /**
   * Create custom playlist
   * POST /api/library/playlists
   */
  public async createPlaylist(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.headers['x-guest-id'] as string) || 'default-user';
      const { name, description } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Playlist name is required' });
        return;
      }

      const db = getDatabase();
      const playlistId = uuidv4();

      db.prepare(`
        INSERT INTO playlists (id, user_id, name, description, cover_url)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        playlistId,
        userId,
        name,
        description || '',
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop'
      );

      res.status(201).json({
        message: 'Playlist created',
        playlist: {
          id: playlistId,
          name,
          description,
          userId,
          tracks: [],
        },
      });
    } catch (error: any) {
      console.error('[UserController] createPlaylist error:', error);
      res.status(500).json({ error: 'Failed to create playlist' });
    }
  }

  /**
   * Add multiple tracks to a playlist in batch (CSV import or bulk operations)
   * POST /api/library/playlists/:playlistId/tracks/batch
   */
  public async addTracksBatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.headers['x-guest-id'] as string) || 'default-user';
      const { playlistId } = req.params;
      const { tracks } = req.body;

      if (!playlistId) {
        res.status(400).json({ error: 'playlistId parameter is required' });
        return;
      }

      if (!Array.isArray(tracks) || tracks.length === 0) {
        res.status(400).json({ error: 'tracks array is required and must not be empty' });
        return;
      }

      const db = getDatabase();
      const playlist = db.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId) as any;

      if (!playlist) {
        res.status(404).json({ error: 'Playlist not found' });
        return;
      }

      const maxPosRow = db.prepare('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?').get(playlistId) as any;
      const startPos = (typeof maxPosRow?.maxPos === 'number' && !isNaN(maxPosRow.maxPos)) ? maxPosRow.maxPos + 1 : 0;

      const insertStmt = db.prepare(`
        INSERT INTO playlist_tracks (id, playlist_id, video_id, title, artist, thumbnail_url, duration, position, added_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const executeBatch = () => {
        for (let i = 0; i < tracks.length; i++) {
          const t = tracks[i];
          const trackId = uuidv4();
          const videoId = t.videoId || t.id || `track-${Date.now()}-${i}`;
          const title = t.title || 'Unknown Title';
          const artist = t.artist || 'Unknown Artist';
          const thumbnailUrl = t.cover || t.thumbnailUrl || t.thumbnail_url || '';

          let duration = 0;
          if (typeof t.duration === 'number') {
            duration = t.duration;
          } else if (typeof t.seconds === 'number') {
            duration = t.seconds;
          } else if (typeof t.durationMs === 'number') {
            duration = Math.round(t.durationMs / 1000);
          } else if (typeof t.duration === 'string') {
            const parts = t.duration.split(':').map((p: string) => parseInt(p, 10));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
              duration = parts[0] * 60 + parts[1];
            } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
              duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
          }

          let addedAt: string;
          if (t.addedAt) {
            if (typeof t.addedAt === 'number') {
              addedAt = new Date(t.addedAt).toISOString();
            } else {
              addedAt = String(t.addedAt);
            }
          } else {
            addedAt = new Date().toISOString();
          }

          insertStmt.run(
            trackId,
            playlistId,
            videoId,
            title,
            artist,
            thumbnailUrl,
            duration,
            startPos + i,
            addedAt
          );
        }

        db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(playlistId);
      };

      if (typeof (db as any).transaction === 'function') {
        (db as any).transaction(executeBatch)();
      } else {
        db.exec('BEGIN');
        try {
          executeBatch();
          db.exec('COMMIT');
        } catch (txErr) {
          db.exec('ROLLBACK');
          throw txErr;
        }
      }

      res.status(200).json({ ok: true, count: tracks.length });
    } catch (error: any) {
      console.error('[UserController] addTracksBatch error:', error);
      res.status(500).json({ error: 'Failed to batch add tracks to playlist' });
    }
  }

  /**
   * Add a single track to playlist
   * POST /api/library/playlists/:playlistId/tracks
   */
  public async addTrack(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.headers['x-guest-id'] as string) || 'default-user';
      const { playlistId } = req.params;
      const track = req.body.track || req.body;

      if (!playlistId) {
        res.status(400).json({ error: 'playlistId parameter is required' });
        return;
      }

      const videoId = track.videoId || track.id;
      if (!videoId) {
        res.status(400).json({ error: 'videoId is required' });
        return;
      }

      const db = getDatabase();
      const playlist = db.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId) as any;

      if (!playlist) {
        res.status(404).json({ error: 'Playlist not found' });
        return;
      }

      const existing = db.prepare('SELECT id FROM playlist_tracks WHERE playlist_id = ? AND video_id = ?').get(playlistId, videoId) as any;
      if (existing) {
        res.status(409).json({ error: 'Track already exists in playlist' });
        return;
      }

      const maxPosRow = db.prepare('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?').get(playlistId) as any;
      const nextPos = (typeof maxPosRow?.maxPos === 'number' && !isNaN(maxPosRow.maxPos)) ? maxPosRow.maxPos + 1 : 0;

      const trackId = uuidv4();
      const title = track.title || 'Unknown Title';
      const artist = track.artist || 'Unknown Artist';
      const thumbnailUrl = track.cover || track.thumbnailUrl || track.thumbnail_url || '';
      const duration = typeof track.duration === 'number' ? track.duration : (track.seconds || 210);
      const addedAt = track.addedAt
        ? (typeof track.addedAt === 'number' ? new Date(track.addedAt).toISOString() : String(track.addedAt))
        : new Date().toISOString();

      db.prepare(`
        INSERT INTO playlist_tracks (id, playlist_id, video_id, title, artist, thumbnail_url, duration, position, added_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        trackId,
        playlistId,
        videoId,
        title,
        artist,
        thumbnailUrl,
        duration,
        nextPos,
        addedAt
      );

      db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(playlistId);

      res.status(201).json({
        ok: true,
        track: {
          id: trackId,
          videoId,
          title,
          artist,
          thumbnailUrl,
          duration,
          position: nextPos,
          addedAt,
        },
      });
    } catch (error: any) {
      console.error('[UserController] addTrack error:', error);
      res.status(500).json({ error: 'Failed to add track to playlist' });
    }
  }

  /**
   * Delete playlist and its tracks
   * DELETE /api/library/playlists/:playlistId
   */
  public async deletePlaylist(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.headers['x-guest-id'] as string) || 'default-user';
      const { playlistId } = req.params;

      if (!playlistId) {
        res.status(400).json({ error: 'playlistId parameter is required' });
        return;
      }

      const db = getDatabase();
      const playlist = db.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId) as any;

      if (!playlist) {
        res.status(404).json({ error: 'Playlist not found' });
        return;
      }

      const executeDelete = () => {
        db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(playlistId);
        db.prepare('DELETE FROM playlists WHERE id = ? AND user_id = ?').run(playlistId, userId);
      };

      if (typeof (db as any).transaction === 'function') {
        (db as any).transaction(executeDelete)();
      } else {
        db.exec('BEGIN');
        try {
          executeDelete();
          db.exec('COMMIT');
        } catch (txErr) {
          db.exec('ROLLBACK');
          throw txErr;
        }
      }

      res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error('[UserController] deletePlaylist error:', error);
      res.status(500).json({ error: 'Failed to delete playlist' });
    }
  }

  /**
   * Remove a track from playlist
   * DELETE /api/library/playlists/:playlistId/tracks/:videoId
   */
  public async removeTrackFromPlaylist(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.headers['x-guest-id'] as string) || 'default-user';
      const { playlistId, videoId } = req.params;

      if (!playlistId || !videoId) {
        res.status(400).json({ error: 'playlistId and videoId are required' });
        return;
      }

      const db = getDatabase();
      const playlist = db.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId) as any;

      if (!playlist) {
        res.status(404).json({ error: 'Playlist not found' });
        return;
      }

      db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND video_id = ?').run(playlistId, videoId);

      res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error('[UserController] removeTrackFromPlaylist error:', error);
      res.status(500).json({ error: 'Failed to remove track from playlist' });
    }
  }

  /**
   * Update mood state (Top Bar & Left Nav synchronization)
   * POST /api/vibe/mood
   */
  public async updateMood(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.headers['x-guest-id'] as string) || 'default-user';
      const { mood, mode } = req.body;
      const db = getDatabase();

      // Ensure user exists
      let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!user) {
        db.prepare(`
          INSERT INTO users (id, name, mode, mood)
          VALUES (?, 'Super Culture Listener', 'public', 'energetic')
        `).run(userId);
      }

      if (mood) {
        db.prepare('UPDATE users SET mood = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(mood.toLowerCase(), userId);
      }
      if (mode) {
        db.prepare('UPDATE users SET mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(mode.toLowerCase(), userId);
      }

      const updated = db.prepare('SELECT mood, mode FROM users WHERE id = ?').get(userId) as any;
      res.json({ mood: updated?.mood, mode: updated?.mode, message: 'User state updated' });
    } catch (error: any) {
      console.error('[UserController] updateMood error:', error);
      res.status(500).json({ error: 'Failed to update user mood/mode' });
    }
  }
}

export const userController = new UserController();
