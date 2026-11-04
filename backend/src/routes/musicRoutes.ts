import { Router } from 'express';
import { musicController, getArtist } from '../controllers/musicController.js';
import { streamRateLimiter } from '../middleware/rateLimiters.js';

const router = Router();

const searchTracks = (req: any, res: any) => musicController.search(req, res);

router.get('/search', searchTracks);
router.get('/artist/:name', getArtist);
router.post('/stream-url', (req, res) => musicController.getStreamUrl(req, res));
router.route('/stream/:videoId')
  .get(streamRateLimiter, (req, res) => musicController.stream(req, res))
  .head(streamRateLimiter, (req, res) => musicController.stream(req, res));
router.get('/up-next/:videoId', (req, res) => musicController.getUpNext(req, res));
router.get('/home-shelves', (req, res) => musicController.getHomeShelves(req, res));
router.post('/import', (req, res) => musicController.importTracklist(req, res));

export default router;
