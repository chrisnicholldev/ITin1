import { apiClient } from './client';
import type { CreateCredentialInput, UpdateCredentialInput } from '@itdesk/shared';

export async function listCredentials(assetId?: string, vendorId?: string) {
  const params: Record<string, string> = {};
  if (assetId) params['assetId'] = assetId;
  if (vendorId) params['vendorId'] = vendorId;
  const { data } = await apiClient.get('/vault', { params: Object.keys(params).length ? params : undefined });
  return data;
}

export async function getCredential(id: string) {
  const { data } = await apiClient.get(`/vault/${id}`);
  return data;
}

export async function revealPassword(id: string): Promise<{ password: string }> {
  const { data } = await apiClient.post(`/vault/${id}/reveal`);
  return data;
}

export async function copyPassword(id: string): Promise<{ password: string }> {
  const { data } = await apiClient.post(`/vault/${id}/copy`);
  return data;
}

export async function createCredential(input: CreateCredentialInput) {
  const { data } = await apiClient.post('/vault', input);
  return data;
}

export async function updateCredential(id: string, input: UpdateCredentialInput) {
  const { data } = await apiClient.patch(`/vault/${id}`, input);
  return data;
}

export async function deleteCredential(id: string) {
  await apiClient.delete(`/vault/${id}`);
}

export async function bulkDeleteCredentials(ids: string[]): Promise<{ deleted: number }> {
  const { data } = await apiClient.delete('/vault', { data: { ids } });
  return data;
}

export async function importCredentials(
  items: Array<{ title: string; username?: string; password: string; url?: string; notes?: string; category?: string }>,
): Promise<{ imported: number; skipped: number }> {
  const { data } = await apiClient.post('/vault/import', items);
  return data;
}

export async function getAuditLog(credentialId?: string) {
  const { data } = await apiClient.get('/vault/audit', {
    params: credentialId ? { credentialId } : undefined,
  });
  return data;
}
