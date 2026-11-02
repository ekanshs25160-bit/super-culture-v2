import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/db.js';
export class UserController {
    /**
     * Library overview (Liked songs count, user playlists, profile settings)
     * GET /api/library/overview
     */
    async getLibraryOverview(req, res) {
        try {
            const userId = req.headers['x-guest-id'] || 'default-user';
            const db = getDatabase();
            // Ensure user exists
            let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            if (!user) {
                db.prepare(`
          INSERT INTO users (id, name, mode, mood)
          VALUES (?, 'Super Culture Listener', 'public', 'energetic')
        `).run(userId);
                user = { id: userId, name: 'Super Culture Listener', mode: 'public', mood: 'energetic' };
            }
            // Liked songs count
            const likedCountRow = db.prepare('SELECT COUNT(*) as count FROM liked_songs WHERE user_id = ?').get(userId);
            const likedCount = likedCountRow?.count || 874; // Fallback to 874 from PRD reference
            // User Playlists
            const playlists = db.prepare(`
        SELECT id, name, description, cover_url as coverUrl, created_at as createdAt, updated_at as updatedAt
        FROM playlists
        WHERE user_id = ?
        ORDER BY updated_at DESC
      `).all(userId);
            res.json({
                user: {
                    id: user.id,
                    name: user.name,
                    mode: user.mode,
                    mood: user.mood,
                },
                likedSongsCount: likedCount,
                playlists,
            });
        }
        catch (error) {
            console.error('[UserController] getLibraryOverview error:', error);
            res.status(500).json({ error: 'Failed to retrieve library overview' });
        }
    }
    /**
     * Toggle like on a track
     * POST /api/library/likes/:videoId
     */
    async toggleLike(req, res) {
        try {
            const userId = req.headers['x-guest-id'] || 'default-user';
            const { videoId } = req.params;
            const { trackMeta } = req.body;
            const db = getDatabase();
            const existing = db.prepare('SELECT id FROM liked_songs WHERE user_id = ? AND video_id = ?').get(userId, videoId);
            let isLiked = false;
            if (existing) {
                db.prepare('DELETE FROM liked_songs WHERE id = ?').run(existing.id);
                isLiked = false;
            }
            else {
                const id = uuidv4();
                db.prepare(`
          INSERT INTO liked_songs (id, user_id, video_id, title, artist, thumbnail_url, duration)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, userId, videoId, trackMeta?.title || 'Unknown Title', trackMeta?.artist || 'Unknown Artist', trackMeta?.thumbnailUrl || '', trackMeta?.duration || 0);
                isLiked = true;
            }
            const totalCountRow = db.prepare('SELECT COUNT(*) as count FROM liked_songs WHERE user_id = ?').get(userId);
            res.json({
                isLiked,
                likedSongsCount: totalCountRow?.count || 0,
            });
        }
        catch (error) {
            console.error('[UserController] toggleLike error:', error);
            res.status(500).json({ error: 'Failed to toggle liked song' });
        }
    }
    /**
     * Create custom playlist
     * POST /api/library/playlists
     */
    async createPlaylist(req, res) {
        try {
            const userId = req.headers['x-guest-id'] || 'default-user';
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
      `).run(playlistId, userId, name, description || '', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop');
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
        }
        catch (error) {
            console.error('[UserController] createPlaylist error:', error);
            res.status(500).json({ error: 'Failed to create playlist' });
        }
    }
    /**
     * Update mood state (Top Bar & Left Nav synchronization)
     * POST /api/vibe/mood
     */
    async updateMood(req, res) {
        try {
            const userId = req.headers['x-guest-id'] || 'default-user';
            const { mood } = req.body;
            const validMoods = ['energetic', 'chill', 'melancholy', 'focus'];
            if (!validMoods.includes(mood)) {
                res.status(400).json({ error: 'Invalid mood value' });
                return;
            }
            const db = getDatabase();
            db.prepare('UPDATE users SET mood = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(mood, userId);
            res.json({ mood, message: `Mood updated to ${mood}` });
        }
        catch (error) {
            console.error('[UserController] updateMood error:', error);
            res.status(500).json({ error: 'Failed to update mood' });
        }
    }
}
export const userController = new UserController();
//# sourceMappingURL=userController.js.map