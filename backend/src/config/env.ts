import dotenv from 'dotenv';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root or backend folder
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export interface AppConfig {
  port: number;
  host: string;
  corsOrigin: string | string[];
  corsOrigins: string[];
  appPasscode: string;
  cookieSecret: string;
  streamSecret: string;
  maxAiCallsPerDay: number;
  geminiApiKey?: string;
  dbPath: string;
  isDev: boolean;
}

const rawCors = process.env.CORS_ORIGIN || '';
const parsedCorsOrigins = rawCors
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

const fallbackStreamSecret = crypto.randomBytes(32).toString('hex');

export const env: AppConfig = {
  port: Number(process.env.PORT) || 5001,
  host: process.env.HOST || '127.0.0.1',
  corsOrigin: parsedCorsOrigins.length > 0 ? parsedCorsOrigins : '*',
  corsOrigins: parsedCorsOrigins,
  appPasscode: process.env.APP_PASSCODE ? process.env.APP_PASSCODE.trim() : '',
  cookieSecret: process.env.COOKIE_SECRET || process.env.APP_PASSCODE || 'super-culture-signed-cookie-secret',
  streamSecret: process.env.STREAM_SECRET ? process.env.STREAM_SECRET.trim() : fallbackStreamSecret,
  maxAiCallsPerDay: Number(process.env.MAX_AI_CALLS_PER_DAY) || 100,
  geminiApiKey: process.env.GEMINI_API_KEY,
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../data/super_culture.db'),
  isDev: process.env.NODE_ENV !== 'production',
};
