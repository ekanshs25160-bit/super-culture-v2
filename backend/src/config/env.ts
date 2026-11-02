import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root or parent if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export interface AppConfig {
  port: number;
  host: string;
  corsOrigin: string | string[];
  geminiApiKey?: string;
  dbPath: string;
  isDev: boolean;
}

export const env: AppConfig = {
  port: Number(process.env.PORT) || 5001,
  host: process.env.HOST || '127.0.0.1',
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  geminiApiKey: process.env.GEMINI_API_KEY,
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../data/super_culture.db'),
  isDev: process.env.NODE_ENV !== 'production',
};
