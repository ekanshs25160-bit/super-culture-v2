import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { getCorsOptions } from './config/cors.js';
import { getDatabase, closeDatabase } from './config/db.js';
import { setupDatabase } from './db/index.js';
import { apiRateLimiter } from './middleware/rateLimiters.js';
import { requestDurationLogger } from './middleware/requestDuration.js';
import { getYtClient } from './services/ytService.js';
import { musicController } from './controllers/musicController.js';
import apiRouter from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 5001;

// Trust reverse proxy (Render / Cloudflare / Vercel) for accurate client IP rate limiting
app.set('trust proxy', 1);

// Request Duration & Performance Logger (method, path, status, ms - flags > 1s as slow)
app.use(requestDurationLogger);

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.youtube.com', 'https://s.ytimg.com'],
        frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        mediaSrc: ["'self'", 'https:', 'blob:', 'data:'],
        connectSrc: ["'self'", 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        fontSrc: ["'self'", 'https:', 'data:'],
      },
    },
  })
);

// Compression Middleware (Bypasses streaming audio chunks)
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression'] || req.path.includes('/stream/')) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

// Access Control - Strict CORS allowlist & preflight handling
app.use(cors(getCorsOptions()));
app.options('*', cors(getCorsOptions()));

// Signed Cookie Parser for Passcode Authentication
app.use(cookieParser(env.cookieSecret));

// Cap request body size at 100kb to mitigate memory exhaustion
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Health Check Endpoint (Lightweight: stays fast without DB or external network calls)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'super-culture-v2-backend',
    timestamp: new Date().toISOString(),
  });
});

// Readiness Probe (Verifies SQLite database connectivity)
app.get('/ready', (_req, res) => {
  try {
    const db = getDatabase();
    db.prepare('SELECT 1').get();
    res.json({
      status: 'ready',
      service: 'super-culture-v2-backend',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'not_ready',
      error: 'Database check failed',
      details: err.message,
    });
  }
});

// Mount Protected API Endpoints with General Rate Limiting
app.use('/api', apiRateLimiter, apiRouter);

// Single-Port Architecture: Serve compiled React frontend
const frontendPath = fs.existsSync(path.join(__dirname, '../../frontend/dist'))
  ? path.join(__dirname, '../../frontend/dist')
  : path.resolve(process.cwd(), 'frontend/dist');

app.use(express.static(frontendPath));

// React Router SPA Catch-All (serves index.html for all non-API GET requests)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend build not found. Please run "npm run build" in the frontend directory.');
  }
});

// Centralized Error Handling (e.g. CORS rejection, payload too large)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err && (err.message?.includes('CORS') || err.name === 'CorsError')) {
    res.status(403).json({ error: 'CORS origin not allowed' });
    return;
  }
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    res.status(413).json({ error: 'Payload too large, maximum size is 100kb' });
    return;
  }
  console.error('[Error]', err.message || 'Internal server error');
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Initialize SQLite schema with WAL + NORMAL synchronous mode & indexes
try {
  setupDatabase();
} catch (dbError: any) {
  console.error('[Startup] Failed to initialize database:', dbError.message || dbError);
}

// Warm home shelves cache and establish 15-minute background refresh
musicController.warmHomeShelvesCache();
const warmShelvesInterval = setInterval(() => {
  musicController.warmHomeShelvesCache();
}, 15 * 60 * 1000);
warmShelvesInterval.unref();

// Eagerly initialize Innertube client singleton at startup
getYtClient().catch((ytErr: any) => {
  console.warn('[Startup] Innertube client background init scheduled:', ytErr.message || ytErr);
});

// Start HTTP Server
let server: ReturnType<typeof app.listen> | undefined;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, env.host, () => {
    console.log(`\n==================================================`);
    console.log(`  Super Culture v2.0 Backend Server Running`);
    console.log(`  Local URL:   http://${env.host}:${PORT}`);
    console.log(`  Environment: ${env.isDev ? 'development' : 'production'}`);
    console.log(`  Passcode:    ${env.appPasscode ? 'ENABLED' : 'DISABLED'}`);
    console.log(`==================================================\n`);
  });
}

// Graceful Shutdown
function handleShutdown(signal: string) {
  console.log(`\n[Process] Received ${signal}. Gracefully shutting down...`);
  clearInterval(warmShelvesInterval);
  if (server) {
    server.close(() => {
      closeDatabase();
      console.log('[Process] Server and database closed. Exiting.');
      process.exit(0);
    });
  } else {
    closeDatabase();
    process.exit(0);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export { app, server };
