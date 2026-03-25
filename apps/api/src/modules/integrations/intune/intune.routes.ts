import { Router, type Router as ExpressRouter } from 'express';
import { requireAuth, requireAdmin } from '../../../middleware/auth.middleware.js';
import { getStatus, triggerSync, getLogs } from './intune.controller.js';

const router: ExpressRouter = Router();

router.use(requireAuth, requireAdmin);

router.get('/status', getStatus);
router.post('/sync', triggerSync);
router.get('/logs', getLogs);

export default router;
