import { apiClient } from './client';
import type { UserResponse } from '@itdesk/shared';

export async function login(username: string, password: string): Promise<{ accessToken: string; expiresIn: number }> {
  const { data } = await apiClient.post('/auth/login', { username, password });
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function getMe(): Promise<UserResponse> {
  const { data } = await apiClient.get('/auth/me');
  return data;
}
