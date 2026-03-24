import { apiClient } from './client';

export async function getUsers(params?: Record<string, string | number>) {
  const { data } = await apiClient.get('/users', { params });
  return data;
}
