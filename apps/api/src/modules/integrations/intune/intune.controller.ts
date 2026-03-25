import type { Request, Response } from 'express';
import { env } from '../../../config/env.js';
import { addIntuneSync, intuneQueue } from '../../../jobs/queues.js';
import { getSyncLogs, getLastSync } from './intune.service.js';
import { AppError } from '../../../middleware/error.middleware.js';

export async function getStatus(_req: Request, res: Response) {
  const lastSync = await getLastSync();
  const waiting = await intuneQueue.getWaitingCount();
  const active = await intuneQueue.getActiveCount();

  res.json({
    enabled: env.INTUNE_ENABLED,
    tenantConfigured: !!(env.INTUNE_TENANT_ID && env.INTUNE_CLIENT_ID && env.INTUNE_CLIENT_SECRET),
    syncSchedule: env.INTUNE_SYNC_SCHEDULE,
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
  if (!env.INTUNE_ENABLED) {
    throw new AppError(400, 'Intune integration is not enabled');
  }
  if (!(env.INTUNE_TENANT_ID && env.INTUNE_CLIENT_ID && env.INTUNE_CLIENT_SECRET)) {
    throw new AppError(400, 'Intune credentials are not configured');
  }

  await addIntuneSync('manual');
  res.status(202).json({ message: 'Sync queued' });
}

export async function getLogs(_req: Request, res: Response) {
  const logs = await getSyncLogs(50);
  res.json({ data: logs });
}
