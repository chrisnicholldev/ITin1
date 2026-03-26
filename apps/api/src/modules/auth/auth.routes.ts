import { Router, type IRouter } from 'express';
import {
  login,
  refresh,
  logoutHandler,
  me,
  twoFactorVerify,
  twoFactorSetup,
  twoFactorConfirm,
  twoFactorDisable,
} from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router: IRouter = Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', requireAuth, logoutHandler);
router.get('/me', requireAuth, me);

// 2FA — setup/confirm accept either tempToken (login flow) or auth header (management)
router.post('/2fa/verify', twoFactorVerify);
router.post('/2fa/setup', twoFactorSetup);
router.post('/2fa/confirm', twoFactorConfirm);
router.delete('/2fa', requireAuth, twoFactorDisable);

export default router;
