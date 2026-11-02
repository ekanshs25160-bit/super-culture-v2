import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from './env.js';

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  };
  close(): void;
}

let dbInstance: SqliteDatabase | null = null;

export function getDatabase(): SqliteDatabase {
  if (dbInstance) {
    return dbInstance;
  }

  const dbDir = path.dirname(env.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  try {
    // Utilize Node 24 native high-performance SQLite engine (zero external native build friction)
    const nativeDb = new DatabaseSync(env.dbPath);
    nativeDb.exec('PRAGMA journal_mode = WAL;');
    nativeDb.exec('PRAGMA synchronous = NORMAL;');
    nativeDb.exec('PRAGMA foreign_keys = ON;');
    
    dbInstance = nativeDb as unknown as SqliteDatabase;
    console.log(`[DB] Connected to SQLite database via node:sqlite at: ${env.dbPath}`);
    return dbInstance;
  } catch (err: any) {
    console.error(`[DB] Failed to connect to SQLite at ${env.dbPath}:`, err.message);
    throw err;
  }
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log('[DB] SQLite connection closed.');
  }
}
