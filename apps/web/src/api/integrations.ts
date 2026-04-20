import { apiClient } from './client';

export async function getIntuneStatus() {
  const { data } = await apiClient.get('/integrations/intune/status');
  return data;
}

export async function triggerIntuneSync() {
  const { data } = await apiClient.post('/integrations/intune/sync');
  return data;
}

export async function getIntuneLogs() {
  const { data } = await apiClient.get('/integrations/intune/logs');
  return data;
}

export async function getMerakiStatus() {
  const { data } = await apiClient.get('/integrations/meraki/status');
  return data;
}

export async function triggerMerakiSync() {
  const { data } = await apiClient.post('/integrations/meraki/sync');
  return data;
}

export async function getMerakiLogs() {
  const { data } = await apiClient.get('/integrations/meraki/logs');
  return data;
}

export async function getAdStatus() {
  const { data } = await apiClient.get('/integrations/ad/status');
  return data;
}

export async function triggerAdSync() {
  const { data } = await apiClient.post('/integrations/ad/sync');
  return data;
}

export async function getAdLogs() {
  const { data } = await apiClient.get('/integrations/ad/logs');
  return data;
}

// ── Integration config ─────────────────────────────────────────────────────

export interface IntegrationConfig {
  intune: {
    enabled: boolean;
    tenantId: string;
    clientId: string;
    hasClientSecret: boolean;
    syncSchedule: string;
  };
  meraki: {
    enabled: boolean;
    hasApiKey: boolean;
    orgId: string;
    syncSchedule: string;
  };
  ad: {
    enabled: boolean;
    url: string;
    bindDn: string;
    hasBindCredentials: boolean;
    searchBase: string;
    computerFilter: string;
    syncSchedule: string;
  };
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    user: string;
    hasPassword: boolean;
    from: string;
  };
  imap: {
    enabled: boolean;
    host: string;
    port: number;
    user: string;
    hasPassword: boolean;
    folder: string;
    defaultCategoryId: string;
  };
}

export async function getIntegrationConfig(): Promise<IntegrationConfig> {
  const { data } = await apiClient.get('/admin/integrations/config');
  return data;
}

export async function updateIntuneConfig(payload: {
  enabled: boolean;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  syncSchedule: string;
}): Promise<IntegrationConfig> {
  const { data } = await apiClient.put('/admin/integrations/config/intune', payload);
  return data;
}

export async function updateMerakiConfig(payload: {
  enabled: boolean;
  apiKey: string;
  orgId: string;
  syncSchedule: string;
}): Promise<IntegrationConfig> {
  const { data } = await apiClient.put('/admin/integrations/config/meraki', payload);
  return data;
}

export async function updateAdConfig(payload: {
  enabled: boolean;
  url: string;
  bindDn: string;
  bindCredentials: string;
  searchBase: string;
  computerFilter: string;
  syncSchedule: string;
}): Promise<IntegrationConfig> {
  const { data } = await apiClient.put('/admin/integrations/config/ad', payload);
  return data;
}

export async function updateSmtpConfig(payload: {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}): Promise<IntegrationConfig> {
  const { data } = await apiClient.put('/admin/integrations/config/smtp', payload);
  return data;
}

export async function sendSmtpTestEmail(to: string): Promise<void> {
  await apiClient.post('/admin/integrations/config/smtp/test', { to });
}

export async function updateImapConfig(payload: {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  pass: string;
  folder: string;
  defaultCategoryId: string;
}): Promise<IntegrationConfig> {
  const { data } = await apiClient.put('/admin/integrations/config/imap', payload);
  return data;
}
