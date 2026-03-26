import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
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

// Middleware that allows either a tempToken in the request body (login flow)
// or a normal Authorization header (management flow for already-logged-in users).
function requireAuthOrTempToken(req: Request, res: Response, next: NextFunction): void {
  if ((req.body as { tempToken?: string }).tempToken) return next();
  requireAuth(req, res, next);
}

router.post('/2fa/verify', twoFactorVerify);
router.post('/2fa/setup', requireAuthOrTempToken, twoFactorSetup);
router.post('/2fa/confirm', requireAuthOrTempToken, twoFactorConfirm);
router.delete('/2fa', requireAuth, twoFactorDisable);

export default router;
