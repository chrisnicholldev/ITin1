import { apiClient } from './client';
import axios from 'axios';

export interface OrgSettings {
  orgName: string;
}

// Public — no auth required, safe to call on login page too
export async function getOrgSettings(): Promise<OrgSettings> {
  const { data } = await axios.get('/api/v1/admin/settings');
  return data;
}

export async function updateOrgSettings(settings: Partial<OrgSettings>): Promise<OrgSettings> {
  const { data } = await apiClient.patch('/admin/settings', settings);
  return data;
}
