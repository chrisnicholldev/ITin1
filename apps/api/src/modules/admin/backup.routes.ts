import { Router, type IRouter, type Request, type Response } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import * as backup from './backup.controller.js';
import { getOrgSettings, updateOrgSettings } from './settings.model.js';

const router: IRouter = Router();

// ── Org settings (GET is public so login page can show org name) ──────────────
router.get('/settings', async (_req: Request, res: Response) => {
  res.json(await getOrgSettings());
});

router.patch('/settings', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { orgName } = req.body as { orgName?: string };
  if (orgName !== undefined && (typeof orgName !== 'string' || orgName.trim().length === 0)) {
    res.status(400).json({ error: 'orgName must be a non-empty string' });
    return;
  }
  res.json(await updateOrgSettings({ orgName: orgName?.trim() }));
});

// ── Backup / restore ─────────────────────────────────────────────────────────
router.get('/backup', requireAuth, requireAdmin, backup.downloadBackup);
router.post('/restore', requireAuth, requireAdmin, backup.uploadRestore);

export default router;
