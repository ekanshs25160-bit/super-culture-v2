import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { env } from './config/env.js';
import { closeDatabase } from './config/db.js';
import { setupDatabase } from './db/index.js';
import { socketService } from './services/socketService.js';
import apiRouter from './routes/index.js';

const app = express();
const server = http.createServer(app);

// Global Middleware
app.use(cors({ origin: '*' })); // You can lock this down to your Vercel URL later
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'super-culture-v2-backend',
    timestamp: new Date().toISOString(),
  });
});

// Mount API Endpoints
app.use('/api', apiRouter);

// Initialize SQLite schema
try {
  setupDatabase();
} catch (dbError) {
  console.error('[Startup] Failed to initialize database:', dbError);
}

// Initialize WebSocket sync for Jam Rooms
socketService.initialize(server);

// Start HTTP & WS Server
server.listen(env.port, env.host, () => {
  console.log(`\n==================================================`);
  console.log(`  Super Culture v2.0 Backend Server Running`);
  console.log(`  Local URL:   http://${env.host}:${env.port}`);
  console.log(`  WebSocket:   ws://${env.host}:${env.port}/ws/jam`);
  console.log(`  Environment: ${env.isDev ? 'development' : 'production'}`);
  console.log(`==================================================\n`);
});

// Graceful Shutdown
function handleShutdown(signal: string) {
  console.log(`\n[Process] Received ${signal}. Gracefully shutting down...`);
  server.close(() => {
    closeDatabase();
    console.log('[Process] Server and database closed. Exiting.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export { app, server };
