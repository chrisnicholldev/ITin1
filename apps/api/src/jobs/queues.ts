import { Queue, Worker, type Job } from 'bullmq';
import { env } from '../config/env.js';
import { runIntuneSync } from '../modules/integrations/intune/intune.service.js';
import { runMerakiSync } from '../modules/integrations/meraki/meraki.service.js';
import { runAdSync } from '../modules/integrations/ad/ad.service.js';
import { getIntuneRuntimeConfig, getMerakiRuntimeConfig, getAdRuntimeConfig } from '../modules/admin/integration-config.service.js';
import { runAssetAlerts } from '../modules/assets/asset-alerts.service.js';
import { runSslCertAlerts } from '../modules/ssl-certs/ssl-cert-alerts.service.js';
import { refreshAllCerts } from '../modules/ssl-certs/ssl-cert.service.js';
import { runLicenseAlerts } from '../modules/licenses/license-alerts.service.js';

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

// ── Asset alerts queue ────────────────────────────────────────────────────────

const ASSET_ALERTS_QUEUE = 'asset-alerts';
const ASSET_ALERTS_JOB_KEY = 'asset-alerts-daily';

export const assetAlertsQueue = new Queue(ASSET_ALERTS_QUEUE, { connection });

export async function addAssetAlerts() {
  await assetAlertsQueue.add('alerts', {}, { jobId: `manual-${Date.now()}` });
}

// ── License alerts queue ──────────────────────────────────────────────────────

const LICENSE_ALERTS_QUEUE   = 'license-alerts';
const LICENSE_ALERTS_JOB_KEY = 'license-alerts-daily';

export const licenseAlertsQueue = new Queue(LICENSE_ALERTS_QUEUE, { connection });

// ── SSL cert queue ────────────────────────────────────────────────────────────

const SSL_CERT_QUEUE     = 'ssl-cert-checks';
const SSL_CERT_JOB_KEY   = 'ssl-cert-daily';

export const sslCertQueue = new Queue(SSL_CERT_QUEUE, { connection });

// ── Workers ───────────────────────────────────────────────────────────────────

let intuneWorker: Worker | null = null;
let merakiWorker: Worker | null = null;
let adWorker: Worker | null = null;
let assetAlertsWorker: Worker | null = null;
let sslCertWorker: Worker | null = null;
let licenseAlertsWorker: Worker | null = null;

export async function startWorkers() {
  const [intuneCfg, merakiCfg, adCfg] = await Promise.all([
    getIntuneRuntimeConfig(),
    getMerakiRuntimeConfig(),
    getAdRuntimeConfig(),
  ]);

  // ── Intune worker ──────────────────────────────────────────────────────────

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

  const intuneSchedule = intuneCfg.syncSchedule;
  if (intuneSchedule) {
    await intuneQueue.upsertJobScheduler(
      INTUNE_REPEAT_JOB_KEY,
      { pattern: intuneSchedule },
      { name: 'sync', data: { triggeredBy: 'schedule' } },
    );
    console.log(`[intune-sync] Worker started, schedule: ${intuneSchedule}`);
  } else {
    await intuneQueue.removeJobScheduler(INTUNE_REPEAT_JOB_KEY);
    console.log('[intune-sync] Worker started, no schedule (manual only)');
  }

  // ── Meraki worker ──────────────────────────────────────────────────────────

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

  const merakiSchedule = merakiCfg.syncSchedule;
  if (merakiSchedule) {
    await merakiQueue.upsertJobScheduler(
      MERAKI_REPEAT_JOB_KEY,
      { pattern: merakiSchedule },
      { name: 'sync', data: { triggeredBy: 'schedule' } },
    );
    console.log(`[meraki-sync] Worker started, schedule: ${merakiSchedule}`);
  } else {
    await merakiQueue.removeJobScheduler(MERAKI_REPEAT_JOB_KEY);
    console.log('[meraki-sync] Worker started, no schedule (manual only)');
  }

  // ── AD worker ──────────────────────────────────────────────────────────────
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

  // ── Asset alerts worker (daily at 08:00) ───────────────────────────────────

  assetAlertsWorker = new Worker(
    ASSET_ALERTS_QUEUE,
    async () => {
      console.log('[asset-alerts] Running expiry digest');
      const result = await runAssetAlerts();
      console.log(`[asset-alerts] Done — sent to ${result.sent}/${result.recipients} admins`);
    },
    { connection, concurrency: 1 },
  );

  assetAlertsWorker.on('failed', (job, err) => {
    console.error(`[asset-alerts] Job ${job?.id} failed:`, err.message);
  });

  await assetAlertsQueue.upsertJobScheduler(
    ASSET_ALERTS_JOB_KEY,
    { pattern: '0 8 * * *' },
    { name: 'alerts', data: {} },
  );
  console.log('[asset-alerts] Worker started, schedule: daily at 08:00');

  // ── SSL cert worker (daily at 07:00 — refresh certs then alert at 08:00) ───

  sslCertWorker = new Worker(
    SSL_CERT_QUEUE,
    async () => {
      console.log('[ssl-certs] Running daily refresh + alerts');
      const refresh = await refreshAllCerts();
      console.log(`[ssl-certs] Refreshed ${refresh.checked} certs, ${refresh.errors} errors`);
      const alerts = await runSslCertAlerts();
      console.log(`[ssl-certs] Alerts sent to ${alerts.sent}/${alerts.recipients} admins`);
    },
    { connection, concurrency: 1 },
  );

  sslCertWorker.on('failed', (job, err) => {
    console.error(`[ssl-certs] Job ${job?.id} failed:`, err.message);
  });

  await sslCertQueue.upsertJobScheduler(
    SSL_CERT_JOB_KEY,
    { pattern: '0 7 * * *' },
    { name: 'check', data: {} },
  );
  console.log('[ssl-certs] Worker started, schedule: daily at 07:00');

  // ── License alerts worker (daily at 08:15) ─────────────────────────────────

  licenseAlertsWorker = new Worker(
    LICENSE_ALERTS_QUEUE,
    async () => {
      console.log('[license-alerts] Running renewal digest');
      const result = await runLicenseAlerts();
      console.log(`[license-alerts] Done — sent to ${result.sent}/${result.recipients} admins`);
    },
    { connection, concurrency: 1 },
  );

  licenseAlertsWorker.on('failed', (job, err) => {
    console.error(`[license-alerts] Job ${job?.id} failed:`, err.message);
  });

  await licenseAlertsQueue.upsertJobScheduler(
    LICENSE_ALERTS_JOB_KEY,
    { pattern: '15 8 * * *' },
    { name: 'alerts', data: {} },
  );
  console.log('[license-alerts] Worker started, schedule: daily at 08:15');
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
  if (assetAlertsWorker) { await assetAlertsWorker.close(); assetAlertsWorker = null; }
  if (sslCertWorker) { await sslCertWorker.close(); sslCertWorker = null; }
  if (licenseAlertsWorker) { await licenseAlertsWorker.close(); licenseAlertsWorker = null; }
  await intuneQueue.close();
  await merakiQueue.close();
  await adQueue.close();
  await assetAlertsQueue.close();
  await sslCertQueue.close();
  await licenseAlertsQueue.close();
}
