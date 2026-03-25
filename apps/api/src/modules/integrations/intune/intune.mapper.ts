import { AssetType, AssetStatus, ExternalSource } from '@itdesk/shared';
import type { AzureDevice } from './intune.client.js';

function mapDeviceType(os: string): string {
  const lower = os.toLowerCase();
  if (lower.includes('mac')) return AssetType.LAPTOP;
  if (lower.includes('ios') || lower.includes('android')) return AssetType.PHONE;
  if (lower.includes('windows')) return AssetType.WORKSTATION;
  return AssetType.OTHER;
}

// physicalIds contains entries like "[SERIAL]:XYZ123", "[ZTDID]:...", "[PURCHASE_ORDER]:..."
function extractPhysicalId(physicalIds: string[], prefix: string): string | undefined {
  const match = physicalIds.find((p) => p.startsWith(`[${prefix}]:`));
  return match ? match.split(':').slice(1).join(':').trim() : undefined;
}

export function mapDeviceToAsset(device: AzureDevice) {
  const owner = device.registeredOwners?.[0];
  const serialNumber = extractPhysicalId(device.physicalIds ?? [], 'SERIAL');

  return {
    name: device.displayName || `Device-${device.id.slice(0, 8)}`,
    type: mapDeviceType(device.operatingSystem ?? ''),
    status: AssetStatus.ACTIVE,
    manufacturer: device.manufacturer || undefined,
    modelName: device.model || undefined,
    serialNumber: serialNumber || undefined,
    specs: {
      os: device.operatingSystem || undefined,
      osVersion: device.operatingSystemVersion || undefined,
    },
    externalSource: ExternalSource.INTUNE,
    externalId: device.id,
    lastSyncedAt: new Date(),
    customFields: {
      azureDeviceId: device.deviceId || undefined,
      trustType: device.trustType || undefined,
      isCompliant: device.isCompliant != null ? String(device.isCompliant) : undefined,
      isManaged: String(device.isManaged),
      lastSignIn: device.approximateLastSignInDateTime || undefined,
      registeredAt: device.registrationDateTime || undefined,
      assignedUserName: owner?.displayName || undefined,
      assignedUserEmail: owner?.mail || undefined,
      assignedUserUPN: owner?.userPrincipalName || undefined,
    },
  };
}
