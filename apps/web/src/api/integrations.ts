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
