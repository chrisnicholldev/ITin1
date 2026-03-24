import { apiClient } from './client';
import type { CreateCredentialInput, UpdateCredentialInput } from '@itdesk/shared';

export async function listCredentials(assetId?: string) {
  const { data } = await apiClient.get('/vault', { params: assetId ? { assetId } : undefined });
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

export async function getAuditLog(credentialId?: string) {
  const { data } = await apiClient.get('/vault/audit', {
    params: credentialId ? { credentialId } : undefined,
  });
  return data;
}
