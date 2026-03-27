import { Asset } from '../../assets/asset.model.js';
import { SyncLog, type ISyncLogDocument } from '../intune/intune.service.js';
import { getAdComputers, type AdComputer } from './ad.client.js';
import { mapComputerToAsset, buildAdMergeFields } from './ad.mapper.js';

// Find an existing asset for this AD computer using a 3-step lookup:
// 1. Own AD asset (subsequent syncs)
// 2. Any asset with adObjectGUID stored in customFields (Intune record merged on a previous run)
// 3. Intune asset whose name matches the computer's cn (first-time hostname match for hybrid joined)
async function findExistingAsset(computer: AdComputer) {
  const byOwn = await Asset.findOne({
    externalSource: 'active_directory',
    externalId: computer.objectGUID,
  });
  if (byOwn) return { asset: byOwn, isMerge: false };

  const byGuid = await Asset.findOne({ 'customFields.adObjectGUID': computer.objectGUID });
  if (byGuid) return { asset: byGuid, isMerge: true };

  const byHostname = await Asset.findOne({
    externalSource: 'intune',
    name: { $regex: new RegExp(`^${computer.cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') },
  });
  if (byHostname) return { asset: byHostname, isMerge: true };

  return null;
}

export async function runAdSync(triggeredBy: 'schedule' | 'manual'): Promise<ISyncLogDocument> {
  const log = await SyncLog.create({
    source: 'active_directory',
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

  let devicesFound = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;
  const syncErrors: string[] = [];

  try {
    const computers = await getAdComputers();
    devicesFound = computers.length;

    for (const computer of computers) {
      try {
        const found = await findExistingAsset(computer);

        if (found) {
          if (found.isMerge) {
            // Merging into an Intune (or other) asset — only write AD-specific fields
            await Asset.findByIdAndUpdate(found.asset._id, {
              $set: { ...buildAdMergeFields(computer), lastSyncedAt: new Date() },
            });
          } else {
            // Own AD asset — full update
            await Asset.findByIdAndUpdate(found.asset._id, {
              $set: mapComputerToAsset(computer),
            });
          }
          updated++;
        } else {
          // No existing asset — create a new AD-owned one (pure on-prem device)
          const mapped = mapComputerToAsset(computer);
          const assetTag = `AD-${computer.cn.slice(0, 12).toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
          await Asset.create({ ...mapped, assetTag, customFields: mapped.customFields ?? {} });
          created++;
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        syncErrors.push(`${computer.cn} (${computer.objectGUID}): ${msg}`);
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

export async function getAdSyncLogs(limit = 20) {
  return SyncLog.find({ source: 'active_directory' })
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();
}

export async function getLastAdSync() {
  return SyncLog.findOne({ source: 'active_directory' }).sort({ startedAt: -1 }).lean();
}
