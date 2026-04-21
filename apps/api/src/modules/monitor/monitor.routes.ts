import { Router, type IRouter } from 'express';
import { requireAuth, requireTech } from '../../middleware/auth.middleware.js';
import { listMonitorStatus, toggleAssetMonitor } from './monitor.controller.js';

const router: IRouter = Router();

router.use(requireAuth, requireTech);

router.get('/', listMonitorStatus);
router.patch('/assets/:id', toggleAssetMonitor);

export default router;
