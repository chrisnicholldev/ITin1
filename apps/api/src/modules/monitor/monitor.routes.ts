import { Router, type IRouter } from 'express';
import { requireAuth, requireTech } from '../../middleware/auth.middleware.js';
import { listMonitorStatus, toggleAssetMonitor, toggleIpMonitor } from './monitor.controller.js';

const router: IRouter = Router();

router.use(requireAuth, requireTech);

router.get('/', listMonitorStatus);
router.patch('/assets/:id', toggleAssetMonitor);
router.patch('/ipam/:id', toggleIpMonitor);

export default router;
