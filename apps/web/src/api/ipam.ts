import { apiClient } from './client';

export interface IpAssignment {
  id: string;
  networkId: string;
  address: string;
  label: string;
  type: 'static' | 'reserved' | 'dhcp';
  asset?: { id: string; name: string; assetTag: string };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GridEntry {
  ip: string;
  type: 'network' | 'broadcast' | 'gateway' | 'static' | 'reserved' | 'dhcp' | 'free';
  label?: string;
  assetName?: string;
}

export interface IpamData {
  network: {
    id: string;
    name: string;
    address: string;
    gateway?: string;
    vlanId?: number;
    dhcpEnabled: boolean;
    dhcpRange?: string;
  };
  subnet: {
    networkAddress: string;
    broadcastAddress: string;
    prefix: number;
    totalAddresses: number;
    usableAddresses: number;
    usedAddresses: number;
    freeAddresses: number;
  };
  canVisualise: boolean;
  grid: GridEntry[];
  assignments: IpAssignment[];
}

export async function getIpam(networkId: string): Promise<IpamData> {
  const { data } = await apiClient.get(`/ipam/${networkId}`);
  return data;
}

export async function assignIp(
  networkId: string,
  input: { address: string; label: string; type?: string; assetId?: string; notes?: string },
): Promise<IpAssignment> {
  const { data } = await apiClient.post(`/ipam/${networkId}`, input);
  return data;
}

export async function updateIpAssignment(
  networkId: string,
  id: string,
  input: { label?: string; type?: string; assetId?: string | null; notes?: string },
): Promise<IpAssignment> {
  const { data } = await apiClient.patch(`/ipam/${networkId}/${id}`, input);
  return data;
}

export async function releaseIp(networkId: string, id: string): Promise<void> {
  await apiClient.delete(`/ipam/${networkId}/${id}`);
}
