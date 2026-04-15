import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireTech, requireAdmin } from '../../middleware/auth.middleware.js';
import * as service from './license.service.js';
import { CreateLicenseSchema, UpdateLicenseSchema } from '@itdesk/shared';

const router: IRouter = Router();

router.use(requireAuth, requireTech);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { status, licenseType, search } = req.query as Record<string, string>;
  res.json(await service.listLicenses({ status, licenseType, search }));
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  res.json(await service.getLicense(String(req.params['id'])));
});

router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateLicenseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  res.status(201).json(await service.createLicense(parsed.data));
});

router.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = UpdateLicenseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  res.json(await service.updateLicense(String(req.params['id']), parsed.data));
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  await service.deleteLicense(String(req.params['id']));
  res.status(204).send();
});

export default router;
