import { apiClient } from './client';
import type { CreateAssetInput, UpdateAssetInput } from '@itdesk/shared';

export async function getAssets(params?: Record<string, string | number>) {
  const { data } = await apiClient.get('/assets', { params });
  return data;
}

export async function getAsset(id: string) {
  const { data } = await apiClient.get(`/assets/${id}`);
  return data;
}

export async function createAsset(input: CreateAssetInput) {
  const { data } = await apiClient.post('/assets', input);
  return data;
}

export async function updateAsset(id: string, input: UpdateAssetInput) {
  const { data } = await apiClient.patch(`/assets/${id}`, input);
  return data;
}

export async function getAssetSummary() {
  const { data } = await apiClient.get('/assets/report/summary');
  return data;
}
