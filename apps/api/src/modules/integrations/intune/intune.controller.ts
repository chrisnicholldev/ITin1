import type { Request, Response } from 'express';
import { addIntuneSync, intuneQueue } from '../../../jobs/queues.js';
import { getSyncLogs, getLastSync } from './intune.service.js';
import { AppError } from '../../../middleware/error.middleware.js';
import { getIntuneRuntimeConfig } from '../../admin/integration-config.service.js';

export async function getStatus(_req: Request, res: Response) {
  const [lastSync, cfg] = await Promise.all([getLastSync(), getIntuneRuntimeConfig()]);
  const waiting = await intuneQueue.getWaitingCount();
  const active = await intuneQueue.getActiveCount();

  res.json({
    enabled: cfg.enabled,
    tenantConfigured: !!(cfg.tenantId && cfg.clientId && cfg.clientSecret),
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
  const cfg = await getIntuneRuntimeConfig();
  if (!cfg.enabled) throw new AppError(400, 'Intune integration is not enabled');
  if (!(cfg.tenantId && cfg.clientId && cfg.clientSecret)) {
    throw new AppError(400, 'Intune credentials are not fully configured');
  }
  await addIntuneSync('manual');
  res.status(202).json({ message: 'Sync queued' });
}

export async function getLogs(_req: Request, res: Response) {
  const logs = await getSyncLogs(50);
  res.json({ data: logs });
}
