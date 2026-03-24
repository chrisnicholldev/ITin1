import { apiClient } from './client';
import type { CreateUserInput, UpdateUserInput } from '@itdesk/shared';

export async function getUsers(params?: Record<string, string | number>) {
  const { data } = await apiClient.get('/users', { params });
  return data;
}

export async function getUser(id: string) {
  const { data } = await apiClient.get(`/users/${id}`);
  return data;
}

export async function createUser(input: CreateUserInput) {
  const { data } = await apiClient.post('/users', input);
  return data;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const { data } = await apiClient.patch(`/users/${id}`, input);
  return data;
}

export async function deactivateUser(id: string) {
  const { data } = await apiClient.delete(`/users/${id}`);
  return data;
}

export async function reactivateUser(id: string) {
  const { data } = await apiClient.post(`/users/${id}/reactivate`);
  return data;
}

export async function resetPassword(id: string, password: string) {
  await apiClient.post(`/users/${id}/reset-password`, { password });
}
