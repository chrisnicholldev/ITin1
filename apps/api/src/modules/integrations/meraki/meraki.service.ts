import { Asset } from '../../assets/asset.model.js';
import { SyncLog } from '../intune/intune.service.js';
import {
  getMerakiOrgs,
  getMerakiNetworks,
  getMerakiDevices,
  getMerakiDeviceStatuses,
} from './meraki.client.js';
import { mapDeviceToAsset } from './meraki.mapper.js';
import { env } from '../../../config/env.js';

export async function runMerakiSync(triggeredBy: 'schedule' | 'manual') {
  const log = await SyncLog.create({
    source: 'meraki',
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
    // Resolve org ID — use configured one or pick the first available
    let orgId = env.MERAKI_ORG_ID;
    if (!orgId) {
      const orgs = await getMerakiOrgs();
      if (!orgs.length) throw new Error('No Meraki organisations found for this API key');
      orgId = orgs[0]!.id;
    }

    // Fetch networks, devices and statuses in parallel
    const [networks, devices, statuses] = await Promise.all([
      getMerakiNetworks(orgId),
      getMerakiDevices(orgId),
      getMerakiDeviceStatuses(orgId),
    ]);

    devicesFound = devices.length;

    // Build lookup maps
    const networkNameById = new Map(networks.map((n) => [n.id, n.name]));
    const statusBySerial = new Map(statuses.map((s) => [s.serial, s]));

    for (const device of devices) {
      try {
        const networkName = networkNameById.get(device.networkId) ?? device.networkId;
        const status = statusBySerial.get(device.serial);
        const mapped = mapDeviceToAsset(device, networkName, status);

        const existing = await Asset.findOne({ externalSource: 'meraki', externalId: device.serial });

        if (existing) {
          await Asset.findByIdAndUpdate(existing._id, { $set: mapped });
          updated++;
        } else {
          const assetTag = `MRK-${device.serial.replace(/:/g, '').slice(-8).toUpperCase()}`;
          await Asset.create({ ...mapped, assetTag, customFields: mapped.customFields ?? {} });
          created++;
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        syncErrors.push(`Device ${device.serial} (${device.name}): ${msg}`);
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

export async function getMerakiSyncLogs(limit = 20) {
  return SyncLog.find({ source: 'meraki' }).sort({ startedAt: -1 }).limit(limit).lean();
}

export async function getLastMerakiSync() {
  return SyncLog.findOne({ source: 'meraki' }).sort({ startedAt: -1 }).lean();
}
