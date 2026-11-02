import { Router } from 'express';
import { musicController } from '../controllers/musicController.js';
const router = Router();
router.get('/search', (req, res) => musicController.search(req, res));
router.get('/stream/:videoId', (req, res) => musicController.stream(req, res));
router.get('/up-next/:videoId', (req, res) => musicController.getUpNext(req, res));
router.get('/home-shelves', (req, res) => musicController.getHomeShelves(req, res));
export default router;
//# sourceMappingURL=musicRoutes.js.map