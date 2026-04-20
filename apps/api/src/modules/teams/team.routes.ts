import { Router, type IRouter, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import * as service from './team.service.js';

const router: IRouter = Router();

router.use(requireAuth);

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  res.json(await service.listTeams());
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  res.json(await service.getTeam(String(req.params.id)));
});

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const input = CreateSchema.parse(req.body);
  res.status(201).json(await service.createTeam(input));
});

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

router.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const input = UpdateSchema.parse(req.body);
  res.json(await service.updateTeam(String(req.params.id), input));
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  await service.deleteTeam(String(req.params.id));
  res.status(204).send();
});

router.post('/:id/members', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { userId } = z.object({ userId: z.string().min(1) }).parse(req.body);
  res.json(await service.addMember(String(req.params.id), userId));
});

router.delete('/:id/members/:userId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  res.json(await service.removeMember(String(req.params.id), String(req.params.userId)));
});

export default router;
