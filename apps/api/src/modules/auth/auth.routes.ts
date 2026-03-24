import { Router, type IRouter } from 'express';
import { login, refresh, logoutHandler, me } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router: IRouter = Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', requireAuth, logoutHandler);
router.get('/me', requireAuth, me);

export default router;
