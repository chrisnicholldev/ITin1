import { apiClient } from './client';
import type { UserResponse } from '@itdesk/shared';

export type LoginResponse =
  | { accessToken: string; expiresIn: number }
  | { twoFactorRequired: true; tempToken: string }
  | { setupRequired: true; tempToken: string };

export async function login(username: string, password: string): Promise<LoginResponse> {
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

export async function twoFactorVerify(
  tempToken: string,
  code: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const { data } = await apiClient.post('/auth/2fa/verify', { tempToken, code });
  return data;
}

export async function twoFactorSetup(
  tempToken?: string,
): Promise<{ qrCodeDataUrl: string; secret: string }> {
  const { data } = await apiClient.post('/auth/2fa/setup', tempToken ? { tempToken } : {});
  return data;
}

export async function twoFactorConfirm(
  code: string,
  tempToken?: string,
): Promise<{ recoveryCodes: string[]; accessToken?: string; expiresIn?: number }> {
  const { data } = await apiClient.post('/auth/2fa/confirm', tempToken ? { tempToken, code } : { code });
  return data;
}

export async function twoFactorDisable(code: string): Promise<void> {
  await apiClient.delete('/auth/2fa', { data: { code } });
}
