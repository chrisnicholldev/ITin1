import { env } from '../../../config/env.js';

const MERAKI_BASE = 'https://api.meraki.com/api/v1';

async function merakiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${MERAKI_BASE}${path}`, {
    headers: {
      'X-Cisco-Meraki-API-Key': env.MERAKI_API_KEY!,
      'Content-Type': 'application/json',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meraki API ${path}: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}

export interface MerakiOrg {
  id: string;
  name: string;
  url: string;
}

export interface MerakiNetwork {
  id: string;
  organizationId: string;
  name: string;
  productTypes: string[];
  timeZone: string;
  tags: string[];
}

export interface MerakiDevice {
  serial: string;
  name: string;
  model: string;
  mac: string;
  lanIp?: string;
  wan1Ip?: string;
  wan2Ip?: string;
  networkId: string;
  productType: string; // appliance | switch | wireless | camera | cellularGateway | sensor
  firmware: string;
  tags: string[];
  notes?: string;
  address?: string;
}

export interface MerakiDeviceStatus {
  serial: string;
  status: 'online' | 'offline' | 'alerting' | 'dormant';
  lastReportedAt: string;
  publicIp?: string;
}

export async function getMerakiOrgs(): Promise<MerakiOrg[]> {
  return merakiGet<MerakiOrg[]>('/organizations');
}

export async function getMerakiNetworks(orgId: string): Promise<MerakiNetwork[]> {
  return merakiGet<MerakiNetwork[]>(`/organizations/${orgId}/networks`);
}

export async function getMerakiDevices(orgId: string): Promise<MerakiDevice[]> {
  return merakiGet<MerakiDevice[]>(`/organizations/${orgId}/devices`);
}

export async function getMerakiDeviceStatuses(orgId: string): Promise<MerakiDeviceStatus[]> {
  return merakiGet<MerakiDeviceStatus[]>(`/organizations/${orgId}/devices/statuses`);
}
