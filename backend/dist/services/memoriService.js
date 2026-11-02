import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/db.js';
export class MemoriService {
    /**
     * Capture a track listening event as a user taste memory turn
     */
    logTrackPlay(userId, track) {
        const db = getDatabase();
        const memoryId = uuidv4();
        const content = `User listened to "${track.title}" by ${track.artist}${track.album ? ` from the album "${track.album}"` : ''}`;
        const stmt = db.prepare(`
      INSERT INTO user_memories (id, user_id, content, category, created_at)
      VALUES (?, ?, ?, 'listening_history', CURRENT_TIMESTAMP)
    `);
        stmt.run(memoryId, userId, content);
    }
    /**
     * Save an explicit user preference or vibe input
     */
    saveTasteFact(userId, fact, category = 'taste_preference') {
        const db = getDatabase();
        const memoryId = uuidv4();
        const stmt = db.prepare(`
      INSERT INTO user_memories (id, user_id, content, category, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
        stmt.run(memoryId, userId, fact, category);
    }
    /**
     * Recall user's recent music taste facts and listening memory
     */
    recallMemories(userId, limit = 15) {
        const db = getDatabase();
        const stmt = db.prepare(`
      SELECT id, user_id as userId, content, category, created_at as createdAt
      FROM user_memories
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
        return stmt.all(userId, limit);
    }
    /**
     * Build a summarized musical profile prompt based on recalled memories
     */
    getTasteProfileContext(userId) {
        const memories = this.recallMemories(userId, 15);
        if (memories.length === 0) {
            return 'No prior listening history recorded. Provide a dynamic, modern eclectic music curation.';
        }
        const items = memories.map((m) => `- ${m.content}`).join('\n');
        return `Recent user listening history and music preferences:\n${items}`;
    }
}
export const memoriService = new MemoriService();
//# sourceMappingURL=memoriService.js.map