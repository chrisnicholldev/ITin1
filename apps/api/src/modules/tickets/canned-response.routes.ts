import { Router, type IRouter } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import * as service from './canned-response.service.js';
import { requireAuth, requireAdmin, requireTech } from '../../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

const router: IRouter = Router();

router.use(requireAuth);

router.get('/', requireTech, async (req: Request, res: Response): Promise<void> => {
  const { category } = req.query as { category?: string };
  res.json(await service.listCannedResponses(category));
});

const CreateSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(10000),
  categoryId: z.string().optional(),
});

router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const input = CreateSchema.parse(req.body);
  const user = (req as AuthenticatedRequest).user;
  res.status(201).json(await service.createCannedResponse(input, user.id));
});

const UpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  body: z.string().min(1).max(10000).optional(),
  categoryId: z.string().nullable().optional(),
});

router.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const input = UpdateSchema.parse(req.body);
  res.json(await service.updateCannedResponse(String(req.params.id), input));
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  await service.deleteCannedResponse(String(req.params.id));
  res.status(204).send();
});

export default router;
