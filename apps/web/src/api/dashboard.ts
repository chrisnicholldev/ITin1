import { apiClient } from './client';

export interface DashboardStats {
  tickets: {
    open: number;
    inProgress: number;
    resolvedThisWeek: number;
    byPriority: Array<{ _id: string; count: number }>;
  };
  assets?: {
    active: number;
    inRepair: number;
    warrantyExpiringSoon: number;
    byType: Array<{ _id: string; count: number }>;
  };
  vault?: { total: number };
  networks?: { total: number };
  racks?: { total: number };
  articles?: { total: number };
  users?: { total: number };
  integrations?: {
    intune: { enabled: boolean; lastSyncAt: string | null; lastSyncStatus: string | null };
    meraki: { enabled: boolean; lastSyncAt: string | null; lastSyncStatus: string | null };
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get('/dashboard/stats');
  return data;
}
