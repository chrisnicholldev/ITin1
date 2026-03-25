import mongoose, { type Document, type Model } from 'mongoose';
import { Asset } from '../../assets/asset.model.js';
import { getManagedDevices } from './intune.client.js';
import { mapDeviceToAsset } from './intune.mapper.js';

// ── Sync log model ────────────────────────────────────────────────────────────

export interface ISyncLog {
  source: string;
  status: 'running' | 'success' | 'failed';
  triggeredBy: 'schedule' | 'manual';
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  devicesFound: number;
  created: number;
  updated: number;
  failed: number;
  syncErrors: string[];
}

export interface ISyncLogDocument extends ISyncLog, Document {}

const syncLogSchema = new mongoose.Schema<ISyncLogDocument>(
  {
    source: { type: String, required: true },
    status: { type: String, enum: ['running', 'success', 'failed'], default: 'running' },
    triggeredBy: { type: String, enum: ['schedule', 'manual'], required: true },
    startedAt: { type: Date, required: true },
    completedAt: Date,
    durationMs: Number,
    devicesFound: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    syncErrors: [String],
  },
  { timestamps: false },
);

syncLogSchema.index({ source: 1, startedAt: -1 });

export const SyncLog: Model<ISyncLogDocument> = mongoose.model<ISyncLogDocument>('SyncLog', syncLogSchema);

// ── Sync logic ────────────────────────────────────────────────────────────────

export async function runIntuneSync(triggeredBy: 'schedule' | 'manual'): Promise<ISyncLogDocument> {
  const log = await SyncLog.create({
    source: 'intune',
    status: 'running',
    triggeredBy,
    startedAt: new Date(),
    devicesFound: 0,
    created: 0,
    updated: 0,
    failed: 0,
    syncErrors: [],
  });

  let devicesFound = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;
  const syncErrors: string[] = [];

  try {
    const devices = await getManagedDevices();
    devicesFound = devices.length;

    for (const device of devices) {
      try {
        const mapped = mapDeviceToAsset(device);

        const existing = await Asset.findOne({ externalSource: 'intune', externalId: device.id });

        if (existing) {
          await Asset.findByIdAndUpdate(existing._id, { $set: mapped });
          updated++;
        } else {
          // Use a deterministic tag based on Intune device ID — avoids race conditions
          // when many devices are created concurrently in a loop
          const assetTag = `INT-${device.id.slice(0, 8).toUpperCase()}`;
          await Asset.create({ ...mapped, assetTag, customFields: mapped.customFields ?? {} });
          created++;
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        syncErrors.push(`Device ${device.id} (${device.displayName}): ${msg}`);
      }
    }

    const completedAt = new Date();
    await SyncLog.findByIdAndUpdate(log._id, {
      $set: {
        status: 'success',
        completedAt,
        durationMs: completedAt.getTime() - log.startedAt.getTime(),
        devicesFound,
        created,
        updated,
        failed,
        syncErrors,
      },
    });
  } catch (err) {
    const completedAt = new Date();
    const msg = err instanceof Error ? err.message : String(err);
    await SyncLog.findByIdAndUpdate(log._id, {
      $set: {
        status: 'failed',
        completedAt,
        durationMs: completedAt.getTime() - log.startedAt.getTime(),
        devicesFound,
        created,
        updated,
        failed,
        syncErrors: [msg, ...syncErrors],
      },
    });
  }

  return (await SyncLog.findById(log._id))!;
}

export async function getSyncLogs(limit = 20) {
  return SyncLog.find({ source: 'intune' })
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();
}

export async function getLastSync() {
  return SyncLog.findOne({ source: 'intune' }).sort({ startedAt: -1 }).lean();
}
