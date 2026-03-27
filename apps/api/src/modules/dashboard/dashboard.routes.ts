import { Router, type IRouter } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { getStats } from './dashboard.controller.js';

const router: IRouter = Router();

router.get('/stats', requireAuth, getStats);

export default router;
