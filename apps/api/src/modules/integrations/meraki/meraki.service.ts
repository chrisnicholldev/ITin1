import { Asset } from '../../assets/asset.model.js';
import { Network } from '../../network/network.model.js';
import { SyncLog } from '../intune/intune.service.js';
import {
  getMerakiOrgs,
  getMerakiNetworks,
  getMerakiDevices,
  getMerakiDeviceStatuses,
  getMerakiVlans,
  getMerakiSwitchInterfaces,
  type MerakiNetwork,
} from './meraki.client.js';
import { mapDeviceToAsset } from './meraki.mapper.js';
import { env } from '../../../config/env.js';

// ── CIDR helpers ──────────────────────────────────────────────────────────────

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function ipInCidr(ip: string, cidr: string): boolean {
  try {
    const [network, bits] = cidr.split('/');
    const mask = (~((1 << (32 - parseInt(bits!, 10))) - 1)) >>> 0;
    return (ipToInt(ip) & mask) === (ipToInt(network!) & mask);
  } catch {
    return false;
  }
}

// ── Network sync helpers ───────────────────────────────────────────────────────

async function syncNetworksForOrg(merakiNetworks: MerakiNetwork[], syncErrors: string[]) {
  let networksCreated = 0;
  let networksUpdated = 0;

  for (const merakiNet of merakiNetworks) {
    // Appliance (MX) networks — sync VLANs
    if (merakiNet.productTypes.includes('appliance')) {
      const vlans = await getMerakiVlans(merakiNet.id);
      for (const vlan of vlans) {
        if (!vlan.subnet) continue;
        try {
          const externalId = `vlan:${merakiNet.id}:${vlan.id}`;
          const dns = vlan.dnsNameservers
            ? vlan.dnsNameservers.split('\n').map(s => s.trim()).filter(Boolean)
            : [];
          const dhcpEnabled = vlan.dhcpHandling === 'Run a DHCP server';
          const payload = {
            name: `${merakiNet.name} — ${vlan.name} (VLAN ${vlan.id})`,
            address: vlan.subnet,
            vlanId: vlan.id,
            gateway: vlan.applianceIp || undefined,
            dnsServers: dns,
            dhcpEnabled,
            description: `Imported from Meraki: ${merakiNet.name}`,
            externalSource: 'meraki',
            externalId,
          };
          const existing = await Network.findOne({ externalSource: 'meraki', externalId });
          if (existing) {
            await Network.findByIdAndUpdate(existing._id, { $set: payload });
            networksUpdated++;
          } else {
            await Network.create(payload);
            networksCreated++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          syncErrors.push(`VLAN ${vlan.id} (${merakiNet.name}): ${msg}`);
        }
      }
    }

    // Switch (MS) networks — sync L3 routing interfaces
    if (merakiNet.productTypes.includes('switch')) {
      const ifaces = await getMerakiSwitchInterfaces(merakiNet.id);
      for (const iface of ifaces) {
        if (!iface.subnet) continue;
        try {
          const externalId = `iface:${merakiNet.id}:${iface.interfaceId}`;
          const payload = {
            name: `${merakiNet.name} — ${iface.name}${iface.vlanId ? ` (VLAN ${iface.vlanId})` : ''}`,
            address: iface.subnet,
            vlanId: iface.vlanId || undefined,
            gateway: iface.interfaceIp || undefined,
            dnsServers: [],
            dhcpEnabled: false,
            description: `Imported from Meraki: ${merakiNet.name}`,
            externalSource: 'meraki',
            externalId,
          };
          const existing = await Network.findOne({ externalSource: 'meraki', externalId });
          if (existing) {
            await Network.findByIdAndUpdate(existing._id, { $set: payload });
            networksUpdated++;
          } else {
            await Network.create(payload);
            networksCreated++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          syncErrors.push(`Switch interface ${iface.name} (${merakiNet.name}): ${msg}`);
        }
      }
    }
  }

  return { networksCreated, networksUpdated };
}

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

    // Sync VLANs and switch routing interfaces into the Networks collection
    const { networksCreated, networksUpdated } = await syncNetworksForOrg(networks, syncErrors);
    console.log(`[meraki-sync] Networks — created: ${networksCreated}, updated: ${networksUpdated}`);

    // Link Meraki assets to networks by IP/CIDR match across ALL network records
    const allNetworkDocs = await Network.find({}).lean();
    const merakiAssets = await Asset.find({ externalSource: 'meraki' }).lean();
    // Build a serial→merakiNetworkId map for fallback linking
    const merakiNetworkById = new Map(networks.map((n) => [n.id, n]));
    let linked = 0;
    for (const asset of merakiAssets) {
      const ip = asset.specs?.ipAddress;
      let match = ip ? allNetworkDocs.find((n) => ipInCidr(ip, n.address)) : undefined;

      // Fallback: if no IP match, link to the single Meraki-imported network
      // that belongs to the same Meraki site (only if exactly one VLAN on that site)
      if (!match) {
        const merakiNetId = asset.customFields?.merakiNetworkId as string | undefined;
        if (merakiNetId) {
          const siteNets = allNetworkDocs.filter(
            (n) => n.externalId?.startsWith(`vlan:${merakiNetId}:`) || n.externalId?.startsWith(`iface:${merakiNetId}:`),
          );
          if (siteNets.length === 1) match = siteNets[0];
        }
      }

      if (match && String(asset.networkId ?? '') !== String(match._id)) {
        await Asset.findByIdAndUpdate(asset._id, { $set: { networkId: match._id } });
        linked++;
      }
    }
    console.log(`[meraki-sync] Linked ${linked} devices to networks`);

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
