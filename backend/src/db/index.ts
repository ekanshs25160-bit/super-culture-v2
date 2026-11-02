import { getDatabase, SqliteDatabase } from '../config/db.js';
import { initializeSchema } from './schema.js';

export * from './schema.js';

export function setupDatabase(): SqliteDatabase {
  const db = getDatabase();
  initializeSchema(db);
  return db;
}
