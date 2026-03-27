import { apiClient } from './client';
import axios from 'axios';

export interface OrgSettings {
  orgName: string;
  orgLogoUrl?: string;
  azureAdEnabled?: boolean;
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

export async function uploadOrgLogo(file: File): Promise<OrgSettings> {
  const form = new FormData();
  form.append('logo', file);
  const { data } = await apiClient.post('/admin/settings/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deleteOrgLogo(): Promise<OrgSettings> {
  const { data } = await apiClient.delete('/admin/settings/logo');
  return data;
}
