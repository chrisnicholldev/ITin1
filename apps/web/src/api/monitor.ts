import { apiClient } from './client';

export interface MonitorEntry {
  sourceId: string;
  sourceType: 'asset' | 'ipam';
  name: string;
  assetTag: string | null;
  type: string;
  ip: string | null;
  networkId: string | null;
  networkName: string | null;
  status: 'up' | 'down' | 'unknown';
  lastCheckedAt: string | null;
  lastLatencyMs: number | null;
  statusChangedAt: string | null;
  uptime24h: number | null;
}

export async function getMonitorStatus(): Promise<MonitorEntry[]> {
  const { data } = await apiClient.get('/monitor');
  return data;
}

export async function toggleMonitor(assetId: string, monitored: boolean): Promise<void> {
  await apiClient.patch(`/monitor/assets/${assetId}`, { monitored });
}
