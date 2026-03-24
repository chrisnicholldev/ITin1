import { apiClient } from './client';
import type { CreateRackInput, UpdateRackInput, CreateRackMountInput, UpdateRackMountInput } from '@itdesk/shared';

export async function listRacks() {
  const { data } = await apiClient.get('/network/racks');
  return data;
}

export async function getRack(id: string) {
  const { data } = await apiClient.get(`/network/racks/${id}`);
  return data;
}

export async function createRack(input: CreateRackInput) {
  const { data } = await apiClient.post('/network/racks', input);
  return data;
}

export async function updateRack(id: string, input: UpdateRackInput) {
  const { data } = await apiClient.patch(`/network/racks/${id}`, input);
  return data;
}

export async function deleteRack(id: string) {
  await apiClient.delete(`/network/racks/${id}`);
}

export async function addMount(rackId: string, input: CreateRackMountInput) {
  const { data } = await apiClient.post(`/network/racks/${rackId}/mounts`, input);
  return data;
}

export async function updateMount(rackId: string, mountId: string, input: UpdateRackMountInput) {
  const { data } = await apiClient.patch(`/network/racks/${rackId}/mounts/${mountId}`, input);
  return data;
}

export async function removeMount(rackId: string, mountId: string) {
  await apiClient.delete(`/network/racks/${rackId}/mounts/${mountId}`);
}

export async function getMountsByAsset(assetId: string) {
  const { data } = await apiClient.get(`/network/racks/by-asset/${assetId}`);
  return data;
}
