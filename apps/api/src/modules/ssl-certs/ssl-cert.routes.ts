import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireTech, requireAdmin } from '../../middleware/auth.middleware.js';
import * as service from './ssl-cert.service.js';

const router: IRouter = Router();

router.use(requireAuth, requireTech);

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  res.json(await service.listCerts());
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  res.json(await service.getCert(String(req.params['id'])));
});

router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { domain, port, notes } = req.body as { domain: string; port?: number; notes?: string };
  if (!domain) { res.status(400).json({ error: 'domain is required' }); return; }
  res.status(201).json(await service.createCert({ domain, port, notes }));
});

router.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { domain, port, notes } = req.body as { domain?: string; port?: number; notes?: string };
  res.json(await service.updateCert(String(req.params['id']), { domain, port, notes }));
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  await service.deleteCert(String(req.params['id']));
  res.status(204).send();
});

router.post('/:id/check', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  res.json(await service.checkAndUpdate(String(req.params['id'])));
});

export default router;
