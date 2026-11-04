import { Router } from 'express';
import musicRoutes from './musicRoutes.js';
import aiRoutes from './aiRoutes.js';
import userRoutes from './userRoutes.js';
import authRoutes from './authRoutes.js';
import { musicController } from '../controllers/musicController.js';
import { getDatabase } from '../config/db.js';
import { passcodeGate } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiters.js';

const apiRouter = Router();

// Passcode authentication route (rate limited, bypasses passcode gate)
apiRouter.use('/auth', authRateLimiter, authRoutes);

// Health probe on /api/health (bypasses passcode gate)
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'super-culture-v2-backend',
    timestamp: new Date().toISOString(),
  });
});

// YouTube audio stream self-test probe on /api/yt/selftest (bypasses passcode gate)
apiRouter.get('/yt/selftest', (req, res) => musicController.selfTest(req, res));
apiRouter.get('/music/selftest', (req, res) => musicController.selfTest(req, res));

// Readiness probe on /api/ready (bypasses passcode gate, checks DB)
apiRouter.get('/ready', (_req, res) => {
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

// Passcode gate middleware: protects all remaining /api routes if APP_PASSCODE is configured
apiRouter.use(passcodeGate);

apiRouter.use('/music', musicRoutes);
apiRouter.use('/yt', musicRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/library', userRoutes);
apiRouter.use('/vibe', userRoutes);

export default apiRouter;
