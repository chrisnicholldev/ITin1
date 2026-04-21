import { apiClient } from './client';

export interface MonitorAsset {
  assetId: string;
  name: string;
  assetTag: string;
  type: string;
  ip: string | null;
  status: 'up' | 'down' | 'unknown';
  lastCheckedAt: string | null;
  lastLatencyMs: number | null;
  statusChangedAt: string | null;
  uptime24h: number | null;
}

export async function getMonitorStatus(): Promise<MonitorAsset[]> {
  const { data } = await apiClient.get('/monitor');
  return data;
}

export async function toggleMonitor(assetId: string, monitored: boolean): Promise<void> {
  await apiClient.patch(`/monitor/assets/${assetId}`, { monitored });
}
