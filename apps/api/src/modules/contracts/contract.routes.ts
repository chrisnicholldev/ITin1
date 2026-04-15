import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireTech, requireAdmin } from '../../middleware/auth.middleware.js';
import * as service from './contract.service.js';
import { CreateContractSchema, UpdateContractSchema } from '@itdesk/shared';

const router: IRouter = Router();

router.use(requireAuth, requireTech);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { status, contractType, search } = req.query as Record<string, string>;
  res.json(await service.listContracts({ status, contractType, search }));
});

router.get('/renewals', async (_req: Request, res: Response): Promise<void> => {
  res.json(await service.getUpcomingRenewals(90));
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  res.json(await service.getContract(String(req.params['id'])));
});

router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateContractSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  res.status(201).json(await service.createContract(parsed.data));
});

router.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = UpdateContractSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  res.json(await service.updateContract(String(req.params['id']), parsed.data));
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  await service.deleteContract(String(req.params['id']));
  res.status(204).send();
});

export default router;
