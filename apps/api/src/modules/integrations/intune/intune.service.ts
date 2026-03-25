import mongoose, { type Document, type Model } from 'mongoose';
import { Asset } from '../../assets/asset.model.js';
import { getAzureUsers, getManagedDevices } from './intune.client.js';
import { mapDeviceToAsset } from './intune.mapper.js';
import { upsertContacts, findContactByUpn } from '../../contacts/contact.service.js';

// ── Sync log model ────────────────────────────────────────────────────────────

export interface ISyncLog {
  source: string;
  status: 'running' | 'success' | 'failed';
  triggeredBy: 'schedule' | 'manual';
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  usersFound: number;
  usersUpserted: number;
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
    usersFound: { type: Number, default: 0 },
    usersUpserted: { type: Number, default: 0 },
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
    usersFound: 0,
    usersUpserted: 0,
    devicesFound: 0,
    created: 0,
    updated: 0,
    failed: 0,
    syncErrors: [],
  });

  let usersFound = 0;
  let usersUpserted = 0;
  let devicesFound = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;
  const syncErrors: string[] = [];

  try {
    // Step 1 — Sync Azure AD users into contacts
    const azureUsers = await getAzureUsers();
    usersFound = azureUsers.length;

    const contactResult = await upsertContacts(azureUsers.map((u) => ({
      azureId: u.id,
      displayName: u.displayName,
      email: u.mail || undefined,
      upn: u.userPrincipalName,
      department: u.department || undefined,
      jobTitle: u.jobTitle || undefined,
      accountEnabled: u.accountEnabled,
    })));
    usersUpserted = contactResult.upserted + contactResult.modified;

    // Step 2 — Sync devices, matching owners to contacts
    const devices = await getManagedDevices();
    devicesFound = devices.length;

    for (const device of devices) {
      try {
        const mapped = mapDeviceToAsset(device);

        // Match registered owner to a contact by UPN
        const ownerUpn = device.registeredOwners?.[0]?.userPrincipalName;
        let assignedContact: mongoose.Types.ObjectId | undefined;
        if (ownerUpn) {
          const contact = await findContactByUpn(ownerUpn);
          if (contact) assignedContact = contact._id as mongoose.Types.ObjectId;
        }

        const existing = await Asset.findOne({ externalSource: 'intune', externalId: device.id });

        if (existing) {
          await Asset.findByIdAndUpdate(existing._id, {
            $set: { ...mapped, ...(assignedContact ? { assignedContact } : {}) },
          });
          updated++;
        } else {
          const assetTag = `INT-${device.id.slice(0, 8).toUpperCase()}`;
          await Asset.create({
            ...mapped,
            assetTag,
            customFields: mapped.customFields ?? {},
            ...(assignedContact ? { assignedContact } : {}),
          });
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
        usersFound,
        usersUpserted,
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
        usersFound,
        usersUpserted,
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
