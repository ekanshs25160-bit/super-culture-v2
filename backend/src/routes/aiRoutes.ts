import { Router } from 'express';
import { aiController } from '../controllers/aiController.js';
import { aiRateLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// Apply stricter AI rate limiting across AI endpoints
router.use(aiRateLimiter);

router.post('/vibe', (req, res) => aiController.generateVibe(req, res));
router.post('/dj', (req, res) => aiController.aiDJ(req, res));
router.post('/log-history', (req, res) => aiController.logHistory(req, res));

export default router;
