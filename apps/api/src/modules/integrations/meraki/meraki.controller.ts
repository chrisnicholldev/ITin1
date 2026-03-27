import type { Request, Response } from 'express';
import { addMerakiSync, merakiQueue } from '../../../jobs/queues.js';
import { getMerakiSyncLogs, getLastMerakiSync } from './meraki.service.js';
import { AppError } from '../../../middleware/error.middleware.js';
import { getMerakiRuntimeConfig } from '../../admin/integration-config.service.js';

export async function getStatus(_req: Request, res: Response) {
  const [lastSync, cfg] = await Promise.all([getLastMerakiSync(), getMerakiRuntimeConfig()]);
  const waiting = await merakiQueue.getWaitingCount();
  const active = await merakiQueue.getActiveCount();

  res.json({
    enabled: cfg.enabled,
    apiKeyConfigured: !!cfg.apiKey,
    orgId: cfg.orgId ?? null,
    queuedJobs: waiting + active,
    lastSync: lastSync
      ? {
          status: lastSync.status,
          triggeredBy: lastSync.triggeredBy,
          startedAt: lastSync.startedAt,
          completedAt: lastSync.completedAt,
          durationMs: lastSync.durationMs,
          devicesFound: lastSync.devicesFound,
          created: lastSync.created,
          updated: lastSync.updated,
          failed: lastSync.failed,
        }
      : null,
  });
}

export async function triggerSync(_req: Request, res: Response) {
  const cfg = await getMerakiRuntimeConfig();
  if (!cfg.enabled) throw new AppError(400, 'Meraki integration is not enabled');
  if (!cfg.apiKey) throw new AppError(400, 'Meraki API key is not configured');
  await addMerakiSync('manual');
  res.status(202).json({ message: 'Sync queued' });
}

export async function getLogs(_req: Request, res: Response) {
  const logs = await getMerakiSyncLogs(50);
  res.json({ data: logs });
}
