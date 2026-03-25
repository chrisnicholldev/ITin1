import { apiClient } from './client';
import type { CreateNetworkInput, UpdateNetworkInput } from '@itdesk/shared';

export async function getNetworks(params?: Record<string, string>) {
  const { data } = await apiClient.get('/network/networks', { params });
  return data;
}

export async function getNetwork(id: string) {
  const { data } = await apiClient.get(`/network/networks/${id}`);
  return data;
}

export async function createNetwork(input: CreateNetworkInput) {
  const { data } = await apiClient.post('/network/networks', input);
  return data;
}

export async function updateNetwork(id: string, input: UpdateNetworkInput) {
  const { data } = await apiClient.patch(`/network/networks/${id}`, input);
  return data;
}

export async function deleteNetwork(id: string) {
  await apiClient.delete(`/network/networks/${id}`);
}
