import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
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

// Max 10 login attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — please try again in 15 minutes' },
});

// Max 10 2FA attempts per IP per 15 minutes
const twoFaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — please try again in 15 minutes' },
});

router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', requireAuth, logoutHandler);
router.get('/me', requireAuth, me);

// Middleware that allows either a tempToken in the request body (login flow)
// or a normal Authorization header (management flow for already-logged-in users).
function requireAuthOrTempToken(req: Request, res: Response, next: NextFunction): void {
  if ((req.body as { tempToken?: string }).tempToken) return next();
  requireAuth(req, res, next);
}

router.post('/2fa/verify', twoFaLimiter, twoFactorVerify);
router.post('/2fa/setup', requireAuthOrTempToken, twoFactorSetup);
router.post('/2fa/confirm', requireAuthOrTempToken, twoFactorConfirm);
router.delete('/2fa', requireAuth, twoFactorDisable);

export default router;
