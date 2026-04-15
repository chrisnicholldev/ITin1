import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireTech, type AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import * as service from './changelog.service.js';
import { CreateChangelogEntrySchema, UpdateChangelogEntrySchema } from '@itdesk/shared';

const router: IRouter = Router();

router.use(requireAuth, requireTech);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { category, search, page, limit } = req.query as Record<string, string>;
  res.json(await service.listEntries({
    category,
    search,
    page:  page  ? Number(page)  : undefined,
    limit: limit ? Number(limit) : undefined,
  }));
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  res.json(await service.getEntry(String(req.params['id'])));
});

// Any tech can log a change
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateChangelogEntrySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  res.status(201).json(await service.createEntry(parsed.data, (req as AuthenticatedRequest).user.id));
});

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = UpdateChangelogEntrySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  res.json(await service.updateEntry(String(req.params['id']), parsed.data));
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  await service.deleteEntry(String(req.params['id']));
  res.status(204).send();
});

export default router;
