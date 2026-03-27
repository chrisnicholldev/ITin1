import { Router, type IRouter } from 'express';
import { requireAuth, requireAdmin } from '../../../middleware/auth.middleware.js';
import * as ad from './ad.controller.js';

const router: IRouter = Router();

router.get('/status', requireAuth, requireAdmin, ad.getStatus);
router.post('/sync', requireAuth, requireAdmin, ad.triggerSync);
router.get('/logs', requireAuth, requireAdmin, ad.getLogs);

export default router;
