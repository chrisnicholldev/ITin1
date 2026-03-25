import { apiClient } from './client';
import type { CreateLocationInput, UpdateLocationInput } from '@itdesk/shared';

export async function getLocations() {
  const { data } = await apiClient.get('/locations');
  return data;
}

export async function createLocation(input: CreateLocationInput) {
  const { data } = await apiClient.post('/locations', input);
  return data;
}

export async function updateLocation(id: string, input: UpdateLocationInput) {
  const { data } = await apiClient.patch(`/locations/${id}`, input);
  return data;
}

export async function deleteLocation(id: string) {
  await apiClient.delete(`/locations/${id}`);
}
