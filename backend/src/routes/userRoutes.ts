import { Router } from 'express';
import { userController } from '../controllers/userController.js';

const router = Router();

// Library routes
router.get('/overview', (req, res) => userController.getLibraryOverview(req, res));
router.post('/likes/:videoId', (req, res) => userController.toggleLike(req, res));
router.post('/playlists', (req, res) => userController.createPlaylist(req, res));
router.post('/playlists/:playlistId/tracks/batch', (req, res) => userController.addTracksBatch(req, res));
router.post('/playlists/:playlistId/tracks', (req, res) => userController.addTrack(req, res));
router.delete('/playlists/:playlistId', (req, res) => userController.deletePlaylist(req, res));
router.delete('/playlists/:playlistId/tracks/:videoId', (req, res) => userController.removeTrackFromPlaylist(req, res));

// Mood route
router.post('/mood', (req, res) => userController.updateMood(req, res));

export default router;
