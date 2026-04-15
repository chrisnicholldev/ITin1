import { apiClient } from './client';
import type { LicenseResponse, CreateLicenseInput, UpdateLicenseInput } from '@itdesk/shared';

export type { LicenseResponse as License };

export async function getLicenses(params?: {
  status?: string;
  licenseType?: string;
  search?: string;
}): Promise<LicenseResponse[]> {
  const { data } = await apiClient.get('/licenses', { params });
  return data;
}

export async function createLicense(input: CreateLicenseInput): Promise<LicenseResponse> {
  const { data } = await apiClient.post('/licenses', input);
  return data;
}

export async function updateLicense(id: string, input: UpdateLicenseInput): Promise<LicenseResponse> {
  const { data } = await apiClient.patch(`/licenses/${id}`, input);
  return data;
}

export async function deleteLicense(id: string): Promise<void> {
  await apiClient.delete(`/licenses/${id}`);
}
