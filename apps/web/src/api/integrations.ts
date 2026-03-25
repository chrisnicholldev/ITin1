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
