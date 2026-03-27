import { Router, type IRouter, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import * as backup from './backup.controller.js';
import { getOrgSettings, updateOrgSettings } from './settings.model.js';
import { getIntegrationConfigMasked, updateIntuneConfig, updateMerakiConfig } from './integration-config.service.js';
import { env } from '../../config/env.js';

const router: IRouter = Router();

// ── Logo upload storage ───────────────────────────────────────────────────────
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve(env.UPLOAD_DIR);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, _file, cb) => {
    cb(null, 'org-logo.png');
  },
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── Org settings (GET is public so login page can show org name) ──────────────
router.get('/settings', async (_req: Request, res: Response) => {
  const settings = await getOrgSettings();
  res.json({ ...settings, azureAdEnabled: env.AZURE_AD_ENABLED });
});

router.patch('/settings', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { orgName } = req.body as { orgName?: string };
  if (orgName !== undefined && (typeof orgName !== 'string' || orgName.trim().length === 0)) {
    res.status(400).json({ error: 'orgName must be a non-empty string' });
    return;
  }
  res.json(await updateOrgSettings({ orgName: orgName?.trim() }));
});

router.post('/settings/logo', requireAuth, requireAdmin, logoUpload.single('logo'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const orgLogoUrl = `/uploads/${req.file.filename}`;
  res.json(await updateOrgSettings({ orgLogoUrl }));
});

router.delete('/settings/logo', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  const logoPath = path.resolve(env.UPLOAD_DIR, 'org-logo.png');
  if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
  res.json(await updateOrgSettings({ orgLogoUrl: undefined }));
});

// ── Integration config ────────────────────────────────────────────────────────
router.get('/integrations/config', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  res.json(await getIntegrationConfigMasked());
});

router.put('/integrations/config/intune', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { enabled, tenantId, clientId, clientSecret, syncSchedule } = req.body as Record<string, string>;
  res.json(await updateIntuneConfig({
    enabled: enabled === 'true' || enabled === true as any,
    tenantId: tenantId || undefined,
    clientId: clientId || undefined,
    clientSecret: clientSecret || undefined,
    syncSchedule: syncSchedule || undefined,
  }));
});

router.put('/integrations/config/meraki', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { enabled, apiKey, orgId, syncSchedule } = req.body as Record<string, string>;
  res.json(await updateMerakiConfig({
    enabled: enabled === 'true' || enabled === true as any,
    apiKey: apiKey || undefined,
    orgId: orgId || undefined,
    syncSchedule: syncSchedule || undefined,
  }));
});

// ── Backup / restore ─────────────────────────────────────────────────────────
router.get('/backup', requireAuth, requireAdmin, backup.downloadBackup);
router.post('/restore', requireAuth, requireAdmin, backup.uploadRestore);

export default router;
