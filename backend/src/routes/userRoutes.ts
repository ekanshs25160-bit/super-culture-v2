import { Router } from 'express';
import { userController } from '../controllers/userController.js';

const router = Router();

// Library routes
router.get('/overview', (req, res) => userController.getLibraryOverview(req, res));
router.post('/likes/:videoId', (req, res) => userController.toggleLike(req, res));
router.post('/playlists', (req, res) => userController.createPlaylist(req, res));

// Mood route
router.post('/mood', (req, res) => userController.updateMood(req, res));

export default router;
