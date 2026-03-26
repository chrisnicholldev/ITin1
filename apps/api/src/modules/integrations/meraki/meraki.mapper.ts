import { AssetType, AssetStatus, ExternalSource } from '@itdesk/shared';
import type { MerakiDevice, MerakiDeviceStatus } from './meraki.client.js';

function mapProductType(productType: string): string {
  switch (productType) {
    case 'appliance':       return AssetType.FIREWALL;
    case 'switch':          return AssetType.SWITCH;
    case 'wireless':        return AssetType.ACCESS_POINT;
    case 'cellularGateway': return AssetType.ROUTER;
    default:                return AssetType.OTHER;
  }
}

function mapStatus(s?: string): string {
  if (s === 'online' || s === 'alerting') return AssetStatus.ACTIVE;
  return AssetStatus.INACTIVE;
}

export function mapDeviceToAsset(
  device: MerakiDevice,
  networkName: string,
  status?: MerakiDeviceStatus,
) {
  const ipAddress = device.lanIp || device.wan1Ip;

  return {
    name: device.name || `Meraki-${device.serial}`,
    type: mapProductType(device.productType),
    status: mapStatus(status?.status),
    serialNumber: device.serial,
    modelName: device.model,
    specs: {
      ipAddress: ipAddress || undefined,
      macAddress: device.mac || undefined,
      os: device.firmware ? `Firmware ${device.firmware}` : undefined,
    },
    notes: device.notes || undefined,
    externalSource: ExternalSource.MERAKI,
    externalId: device.serial,
    lastSyncedAt: new Date(),
    customFields: {
      merakiNetworkId: device.networkId,
      merakiNetworkName: networkName,
      productType: device.productType,
      firmware: device.firmware || undefined,
      merakiStatus: status?.status || undefined,
      lastReportedAt: status?.lastReportedAt || undefined,
      publicIp: status?.publicIp || undefined,
      tags: device.tags?.length ? device.tags.join(', ') : undefined,
      dashboardUrl: device.url || undefined,
    },
  };
}
