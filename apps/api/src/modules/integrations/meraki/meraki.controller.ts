import type { Request, Response } from 'express';
import { env } from '../../../config/env.js';
import { addMerakiSync, merakiQueue } from '../../../jobs/queues.js';
import { getMerakiSyncLogs, getLastMerakiSync } from './meraki.service.js';
import { AppError } from '../../../middleware/error.middleware.js';

export async function getStatus(_req: Request, res: Response) {
  const lastSync = await getLastMerakiSync();
  const waiting = await merakiQueue.getWaitingCount();
  const active = await merakiQueue.getActiveCount();

  res.json({
    enabled: env.MERAKI_ENABLED,
    apiKeyConfigured: !!env.MERAKI_API_KEY,
    orgId: env.MERAKI_ORG_ID ?? null,
    syncSchedule: env.MERAKI_SYNC_SCHEDULE ?? null,
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
  if (!env.MERAKI_ENABLED) throw new AppError(400, 'Meraki integration is not enabled');
  if (!env.MERAKI_API_KEY) throw new AppError(400, 'MERAKI_API_KEY is not configured');

  await addMerakiSync('manual');
  res.status(202).json({ message: 'Sync queued' });
}

export async function getLogs(_req: Request, res: Response) {
  const logs = await getMerakiSyncLogs(50);
  res.json({ data: logs });
}
