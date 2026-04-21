import type { Request, Response } from 'express';
import { getMonitorStatus, toggleMonitored } from './monitor.service.js';
import { AppError } from '../../middleware/error.middleware.js';
import { z } from 'zod';

export async function listMonitorStatus(req: Request, res: Response): Promise<void> {
  res.json(await getMonitorStatus());
}

export async function toggleAssetMonitor(req: Request, res: Response): Promise<void> {
  const { monitored } = z.object({ monitored: z.boolean() }).parse(req.body);
  const id = String(req.params['id'] ?? '');
  if (!id) throw new AppError(400, 'Asset ID required');
  await toggleMonitored(id, monitored);
  res.status(204).send();
}
