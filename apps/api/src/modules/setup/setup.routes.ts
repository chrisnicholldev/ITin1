import { Router, type IRouter, type Request, type Response } from 'express';
import { getSetupStatus, completeSetup } from './setup.service.js';
import { AppError } from '../../middleware/error.middleware.js';

const router: IRouter = Router();

// Public — no auth required
router.get('/status', async (_req: Request, res: Response) => {
  const status = await getSetupStatus();
  res.json(status);
});

router.post('/complete', async (req: Request, res: Response) => {
  const { orgName, adminDisplayName, adminEmail, adminUsername, adminPassword, smtp } = req.body;

  if (!orgName?.trim()) throw new AppError(400, 'Organisation name is required');
  if (!adminDisplayName?.trim()) throw new AppError(400, 'Admin display name is required');
  if (!adminEmail?.trim()) throw new AppError(400, 'Admin email is required');
  if (!adminUsername?.trim()) throw new AppError(400, 'Admin username is required');
  if (!adminPassword || adminPassword.length < 8) throw new AppError(400, 'Password must be at least 8 characters');

  await completeSetup({ orgName, adminDisplayName, adminEmail, adminUsername, adminPassword, smtp });
  res.json({ success: true });
});

export default router;
