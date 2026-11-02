import { Router } from 'express';
import musicRoutes from './musicRoutes.js';
import aiRoutes from './aiRoutes.js';
import jamRoutes from './jamRoutes.js';
import userRoutes from './userRoutes.js';
const apiRouter = Router();
apiRouter.use('/yt', musicRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/jam', jamRoutes);
apiRouter.use('/library', userRoutes);
apiRouter.use('/vibe', userRoutes);
export default apiRouter;
//# sourceMappingURL=index.js.map