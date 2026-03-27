import type { Request, Response } from 'express';
import { addAdSync, adQueue } from '../../../jobs/queues.js';
import { getAdSyncLogs, getLastAdSync } from './ad.service.js';
import { AppError } from '../../../middleware/error.middleware.js';
import { getAdRuntimeConfig } from '../../admin/integration-config.service.js';

export async function getStatus(_req: Request, res: Response) {
  const [lastSync, cfg] = await Promise.all([getLastAdSync(), getAdRuntimeConfig()]);
  const waiting = await adQueue.getWaitingCount();
  const active = await adQueue.getActiveCount();

  res.json({
    enabled: cfg.enabled,
    configured: !!(cfg.url && cfg.bindDn && cfg.bindCredentials && cfg.searchBase),
    url: cfg.url ?? null,
    searchBase: cfg.searchBase ?? null,
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
  const cfg = await getAdRuntimeConfig();
  if (!cfg.enabled) throw new AppError(400, 'Active Directory integration is not enabled');
  if (!(cfg.url && cfg.bindDn && cfg.bindCredentials && cfg.searchBase)) {
    throw new AppError(400, 'Active Directory connection is not fully configured');
  }
  await addAdSync('manual');
  res.status(202).json({ message: 'Sync queued' });
}

export async function getLogs(_req: Request, res: Response) {
  const logs = await getAdSyncLogs(50);
  res.json({ data: logs });
}
