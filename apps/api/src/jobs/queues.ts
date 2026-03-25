import { Queue, Worker, type Job } from 'bullmq';
import { env } from '../config/env.js';
import { runIntuneSync } from '../modules/integrations/intune/intune.service.js';

// BullMQ requires its own connection config — passing the shared ioredis instance
// causes version mismatch errors due to pnpm deduplication. Use URL-parsed options instead.
const redisUrl = new URL(env.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  ...(redisUrl.password ? { password: redisUrl.password } : {}),
  maxRetriesPerRequest: null,
};

// ── Intune sync queue ─────────────────────────────────────────────────────────

const INTUNE_QUEUE = 'intune-sync';
const INTUNE_REPEAT_JOB_KEY = 'intune-sync-scheduled';

export const intuneQueue = new Queue(INTUNE_QUEUE, { connection });

export async function addIntuneSync(triggeredBy: 'manual' | 'schedule' = 'manual') {
  await intuneQueue.add('sync', { triggeredBy }, { jobId: triggeredBy === 'manual' ? `manual-${Date.now()}` : undefined });
}

// ── Workers ───────────────────────────────────────────────────────────────────

let intuneWorker: Worker | null = null;

export async function startWorkers() {
  if (!env.INTUNE_ENABLED) return;

  intuneWorker = new Worker(
    INTUNE_QUEUE,
    async (job: Job) => {
      const triggeredBy = job.data?.triggeredBy ?? 'schedule';
      console.log(`[intune-sync] Starting sync (${triggeredBy})`);
      const log = await runIntuneSync(triggeredBy);
      console.log(
        `[intune-sync] Done — created: ${log.created}, updated: ${log.updated}, failed: ${log.failed}`,
      );
    },
    { connection, concurrency: 1 },
  );

  intuneWorker.on('failed', (job, err) => {
    console.error(`[intune-sync] Job ${job?.id} failed:`, err.message);
  });

  // Register repeatable schedule only if a cron pattern is configured
  if (env.INTUNE_SYNC_SCHEDULE) {
    await intuneQueue.upsertJobScheduler(
      INTUNE_REPEAT_JOB_KEY,
      { pattern: env.INTUNE_SYNC_SCHEDULE },
      { name: 'sync', data: { triggeredBy: 'schedule' } },
    );
    console.log(`[intune-sync] Worker started, schedule: ${env.INTUNE_SYNC_SCHEDULE}`);
  } else {
    // Remove any previously registered schedule
    await intuneQueue.removeJobScheduler(INTUNE_REPEAT_JOB_KEY);
    console.log('[intune-sync] Worker started, no schedule (manual only)');
  }
}

export async function stopWorkers() {
  if (intuneWorker) {
    await intuneWorker.close();
    intuneWorker = null;
  }
  await intuneQueue.close();
}
