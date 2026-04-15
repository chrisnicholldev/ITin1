import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireTech, requireAdmin, type AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import * as service from './checklist.service.js';
import { CreateChecklistTemplateSchema, UpdateChecklistTemplateSchema, CreateChecklistRunSchema, UpdateChecklistRunSchema } from '@itdesk/shared';

const router: IRouter = Router();

router.use(requireAuth, requireTech);

function userId(req: Request) { return (req as AuthenticatedRequest).user.id; }

// ── Templates ─────────────────────────────────────────────────────────────────

router.get('/templates', async (_req: Request, res: Response): Promise<void> => {
  res.json(await service.listTemplates());
});

router.get('/templates/:id', async (req: Request, res: Response): Promise<void> => {
  res.json(await service.getTemplate(String(req.params['id'])));
});

router.post('/templates', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateChecklistTemplateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  res.status(201).json(await service.createTemplate(parsed.data, userId(req)));
});

router.patch('/templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = UpdateChecklistTemplateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  res.json(await service.updateTemplate(String(req.params['id']), parsed.data));
});

router.delete('/templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  await service.deleteTemplate(String(req.params['id']));
  res.status(204).send();
});

// ── Runs ──────────────────────────────────────────────────────────────────────

router.get('/runs', async (req: Request, res: Response): Promise<void> => {
  const { status, type } = req.query as Record<string, string>;
  res.json(await service.listRuns({ status, type }));
});

router.get('/runs/:id', async (req: Request, res: Response): Promise<void> => {
  res.json(await service.getRun(String(req.params['id'])));
});

router.post('/runs', async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateChecklistRunSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  res.status(201).json(await service.createRun(parsed.data, userId(req)));
});

router.patch('/runs/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = UpdateChecklistRunSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message }); return; }
  res.json(await service.updateRun(String(req.params['id']), parsed.data));
});

router.delete('/runs/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  await service.deleteRun(String(req.params['id']));
  res.status(204).send();
});

router.post('/runs/:id/items/:itemId/toggle', async (req: Request, res: Response): Promise<void> => {
  res.json(await service.toggleItem(String(req.params['id']), String(req.params['itemId']), userId(req)));
});

router.patch('/runs/:id/items/:itemId/notes', async (req: Request, res: Response): Promise<void> => {
  const { notes } = req.body as { notes: string };
  res.json(await service.updateItemNotes(String(req.params['id']), String(req.params['itemId']), notes ?? ''));
});

export default router;
