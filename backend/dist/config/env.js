import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env from backend root or parent if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();
export const env = {
    port: Number(process.env.PORT) || 4000,
    host: process.env.HOST || '0.0.0.0',
    corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    geminiApiKey: process.env.GEMINI_API_KEY,
    dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../data/super_culture.db'),
    isDev: process.env.NODE_ENV !== 'production',
};
//# sourceMappingURL=env.js.map