import { apiClient } from './client';

export interface SslCert {
  id: string;
  domain: string;
  port: number;
  commonName?: string;
  issuer?: string;
  issuedAt?: string;
  expiresAt?: string;
  sans: string[];
  notes?: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'error' | 'unknown';
  checkError?: string;
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getSslCerts(): Promise<SslCert[]> {
  const { data } = await apiClient.get('/ssl-certs');
  return data;
}

export async function createSslCert(input: { domain: string; port?: number; notes?: string }): Promise<SslCert> {
  const { data } = await apiClient.post('/ssl-certs', input);
  return data;
}

export async function updateSslCert(id: string, input: { domain?: string; port?: number; notes?: string }): Promise<SslCert> {
  const { data } = await apiClient.patch(`/ssl-certs/${id}`, input);
  return data;
}

export async function deleteSslCert(id: string): Promise<void> {
  await apiClient.delete(`/ssl-certs/${id}`);
}

export async function checkSslCert(id: string): Promise<SslCert> {
  const { data } = await apiClient.post(`/ssl-certs/${id}/check`);
  return data;
}
