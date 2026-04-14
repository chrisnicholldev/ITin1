import { apiClient } from './client';

export interface CreateSharePayload {
  contentType: 'credential' | 'note';
  credentialId?: string;
  content?: string;
  recipientEmail: string;
  expiresInHours: number;
  viewLimit: number;
}

export interface ShareResult {
  ok: boolean;
  expiresAt: string;
  viewLimit: number;
}

export interface ViewShareResult {
  content: string;
  contentType: 'credential' | 'note';
  credentialTitle?: string;
  viewsRemaining: number;
  expiresAt: string;
}

export interface ViewShareError {
  error: 'not_found' | 'destroyed' | 'expired' | 'limit_reached';
  message: string;
}

export async function createSecureShare(payload: CreateSharePayload): Promise<ShareResult> {
  const { data } = await apiClient.post('/secure-share', payload);
  return data;
}

export async function viewSecureShare(token: string): Promise<ViewShareResult> {
  const { data } = await apiClient.get(`/secure-share/${token}`);
  return data;
}
