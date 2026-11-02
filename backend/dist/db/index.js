import { getDatabase } from '../config/db.js';
import { initializeSchema } from './schema.js';
export * from './schema.js';
export function setupDatabase() {
    const db = getDatabase();
    initializeSchema(db);
    return db;
}
//# sourceMappingURL=index.js.map