import { AssetType, AssetStatus, ExternalSource } from '@itdesk/shared';
import type { AdComputer } from './ad.client.js';

function mapComputerType(os?: string): string {
  if (!os) return AssetType.WORKSTATION;
  const lower = os.toLowerCase();
  if (lower.includes('server')) return AssetType.SERVER;
  return AssetType.WORKSTATION;
}

// Windows FILETIME = 100-ns intervals since 1601-01-01
// Convert to JS Date (milliseconds since 1970-01-01)
function filetimeToDate(filetime?: string): Date | undefined {
  if (!filetime || filetime === '0') return undefined;
  try {
    const ms = Number(BigInt(filetime) / 10000n - 11644473600000n);
    if (ms <= 0) return undefined;
    return new Date(ms);
  } catch {
    return undefined;
  }
}

// userAccountControl bit 0x0002 = disabled
function isDisabled(uac?: string): boolean {
  if (!uac) return false;
  return (Number(uac) & 0x0002) !== 0;
}

export function mapComputerToAsset(computer: AdComputer) {
  const lastLogon = filetimeToDate(computer.lastLogonTimestamp);

  return {
    name: computer.dNSHostName || computer.cn,
    type: mapComputerType(computer.operatingSystem),
    status: isDisabled(computer.userAccountControl) ? AssetStatus.INACTIVE : AssetStatus.ACTIVE,
    specs: {
      os: computer.operatingSystem || undefined,
      osVersion: computer.operatingSystemVersion || undefined,
    },
    notes: computer.description || undefined,
    externalSource: ExternalSource.ACTIVE_DIRECTORY,
    externalId: computer.objectGUID,
    lastSyncedAt: new Date(),
    customFields: {
      adDn: computer.dn,
      adCn: computer.cn,
      dNSHostName: computer.dNSHostName || undefined,
      lastLogon: lastLogon?.toISOString() || undefined,
      whenCreated: computer.whenCreated || undefined,
    },
  };
}
