import { Router } from 'express';
import { aiController } from '../controllers/aiController.js';

const router = Router();

router.post('/vibe', (req, res) => aiController.generateVibe(req, res));
router.post('/dj', (req, res) => aiController.aiDJ(req, res));
router.post('/log-history', (req, res) => aiController.logHistory(req, res));

export default router;
