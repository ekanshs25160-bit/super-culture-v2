import { Router } from 'express';
import { jamController } from '../controllers/jamController.js';
const router = Router();
router.post('/create', (req, res) => jamController.createRoom(req, res));
router.post('/join', (req, res) => jamController.joinRoom(req, res));
router.get('/active/public', (req, res) => jamController.getActivePublicRooms(req, res));
router.post('/:roomId/queue', (req, res) => jamController.addToQueue(req, res));
router.post('/:roomId/heartbeat', (req, res) => jamController.heartbeat(req, res));
export default router;
//# sourceMappingURL=jamRoutes.js.map