import { Queue, Worker, type Job } from 'bullmq';
import { env } from '../config/env.js';
import { runIntuneSync } from '../modules/integrations/intune/intune.service.js';
import { runMerakiSync } from '../modules/integrations/meraki/meraki.service.js';
import { runAdSync } from '../modules/integrations/ad/ad.service.js';
import { getAdRuntimeConfig } from '../modules/admin/integration-config.service.js';

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

// ── Meraki sync queue ─────────────────────────────────────────────────────────

const MERAKI_QUEUE = 'meraki-sync';
const MERAKI_REPEAT_JOB_KEY = 'meraki-sync-scheduled';

export const merakiQueue = new Queue(MERAKI_QUEUE, { connection });

export async function addMerakiSync(triggeredBy: 'manual' | 'schedule' = 'manual') {
  await merakiQueue.add('sync', { triggeredBy }, { jobId: triggeredBy === 'manual' ? `manual-${Date.now()}` : undefined });
}

// ── AD sync queue ─────────────────────────────────────────────────────────────

const AD_QUEUE = 'ad-sync';
const AD_REPEAT_JOB_KEY = 'ad-sync-scheduled';

export const adQueue = new Queue(AD_QUEUE, { connection });

export async function addAdSync(triggeredBy: 'manual' | 'schedule' = 'manual') {
  await adQueue.add('sync', { triggeredBy }, { jobId: triggeredBy === 'manual' ? `manual-${Date.now()}` : undefined });
}

// ── Workers ───────────────────────────────────────────────────────────────────

let intuneWorker: Worker | null = null;
let merakiWorker: Worker | null = null;
let adWorker: Worker | null = null;

export async function startWorkers() {
  // ── Intune worker ──────────────────────────────────────────────────────────

  if (env.INTUNE_ENABLED) {
    intuneWorker = new Worker(
      INTUNE_QUEUE,
      async (job: Job) => {
        const triggeredBy = job.data?.triggeredBy ?? 'schedule';
        console.log(`[intune-sync] Starting sync (${triggeredBy})`);
        const log = await runIntuneSync(triggeredBy);
        console.log(`[intune-sync] Done — created: ${log.created}, updated: ${log.updated}, failed: ${log.failed}`);
      },
      { connection, concurrency: 1 },
    );

    intuneWorker.on('failed', (job, err) => {
      console.error(`[intune-sync] Job ${job?.id} failed:`, err.message);
    });

    if (env.INTUNE_SYNC_SCHEDULE) {
      await intuneQueue.upsertJobScheduler(
        INTUNE_REPEAT_JOB_KEY,
        { pattern: env.INTUNE_SYNC_SCHEDULE },
        { name: 'sync', data: { triggeredBy: 'schedule' } },
      );
      console.log(`[intune-sync] Worker started, schedule: ${env.INTUNE_SYNC_SCHEDULE}`);
    } else {
      await intuneQueue.removeJobScheduler(INTUNE_REPEAT_JOB_KEY);
      console.log('[intune-sync] Worker started, no schedule (manual only)');
    }
  }

  // ── Meraki worker ──────────────────────────────────────────────────────────

  if (env.MERAKI_ENABLED) {
    merakiWorker = new Worker(
      MERAKI_QUEUE,
      async (job: Job) => {
        const triggeredBy = job.data?.triggeredBy ?? 'schedule';
        console.log(`[meraki-sync] Starting sync (${triggeredBy})`);
        const log = await runMerakiSync(triggeredBy);
        console.log(`[meraki-sync] Done — created: ${log.created}, updated: ${log.updated}, failed: ${log.failed}`);
      },
      { connection, concurrency: 1 },
    );

    merakiWorker.on('failed', (job, err) => {
      console.error(`[meraki-sync] Job ${job?.id} failed:`, err.message);
    });

    if (env.MERAKI_SYNC_SCHEDULE) {
      await merakiQueue.upsertJobScheduler(
        MERAKI_REPEAT_JOB_KEY,
        { pattern: env.MERAKI_SYNC_SCHEDULE },
        { name: 'sync', data: { triggeredBy: 'schedule' } },
      );
      console.log(`[meraki-sync] Worker started, schedule: ${env.MERAKI_SYNC_SCHEDULE}`);
    } else {
      await merakiQueue.removeJobScheduler(MERAKI_REPEAT_JOB_KEY);
      console.log('[meraki-sync] Worker started, no schedule (manual only)');
    }
  }

  // ── AD worker ──────────────────────────────────────────────────────────────

  const adCfg = await getAdRuntimeConfig();
  adWorker = new Worker(
    AD_QUEUE,
    async (job: Job) => {
      const triggeredBy = job.data?.triggeredBy ?? 'schedule';
      console.log(`[ad-sync] Starting sync (${triggeredBy})`);
      const log = await runAdSync(triggeredBy);
      console.log(`[ad-sync] Done — created: ${log.created}, updated: ${log.updated}, failed: ${log.failed}`);
    },
    { connection, concurrency: 1 },
  );

  adWorker.on('failed', (job, err) => {
    console.error(`[ad-sync] Job ${job?.id} failed:`, err.message);
  });

  if (adCfg.syncSchedule) {
    await adQueue.upsertJobScheduler(
      AD_REPEAT_JOB_KEY,
      { pattern: adCfg.syncSchedule },
      { name: 'sync', data: { triggeredBy: 'schedule' } },
    );
    console.log(`[ad-sync] Worker started, schedule: ${adCfg.syncSchedule}`);
  } else {
    await adQueue.removeJobScheduler(AD_REPEAT_JOB_KEY);
    console.log('[ad-sync] Worker started, no schedule (manual only)');
  }
}

// ── Live schedule updates (called after config saves) ─────────────────────────

export async function applyIntuneSchedule(schedule: string | undefined) {
  if (schedule?.trim()) {
    await intuneQueue.upsertJobScheduler(
      INTUNE_REPEAT_JOB_KEY,
      { pattern: schedule.trim() },
      { name: 'sync', data: { triggeredBy: 'schedule' } },
    );
    console.log(`[intune-sync] Schedule updated: ${schedule}`);
  } else {
    await intuneQueue.removeJobScheduler(INTUNE_REPEAT_JOB_KEY);
    console.log('[intune-sync] Schedule cleared (manual only)');
  }
}

export async function applyMerakiSchedule(schedule: string | undefined) {
  if (schedule?.trim()) {
    await merakiQueue.upsertJobScheduler(
      MERAKI_REPEAT_JOB_KEY,
      { pattern: schedule.trim() },
      { name: 'sync', data: { triggeredBy: 'schedule' } },
    );
    console.log(`[meraki-sync] Schedule updated: ${schedule}`);
  } else {
    await merakiQueue.removeJobScheduler(MERAKI_REPEAT_JOB_KEY);
    console.log('[meraki-sync] Schedule cleared (manual only)');
  }
}

export async function applyAdSchedule(schedule: string | undefined) {
  if (schedule?.trim()) {
    await adQueue.upsertJobScheduler(
      AD_REPEAT_JOB_KEY,
      { pattern: schedule.trim() },
      { name: 'sync', data: { triggeredBy: 'schedule' } },
    );
    console.log(`[ad-sync] Schedule updated: ${schedule}`);
  } else {
    await adQueue.removeJobScheduler(AD_REPEAT_JOB_KEY);
    console.log('[ad-sync] Schedule cleared (manual only)');
  }
}

export async function stopWorkers() {
  if (intuneWorker) { await intuneWorker.close(); intuneWorker = null; }
  if (merakiWorker) { await merakiWorker.close(); merakiWorker = null; }
  if (adWorker) { await adWorker.close(); adWorker = null; }
  await intuneQueue.close();
  await merakiQueue.close();
  await adQueue.close();
}
