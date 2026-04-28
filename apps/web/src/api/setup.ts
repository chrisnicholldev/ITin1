import { apiClient } from './client';

export async function getSetupStatus(): Promise<{ complete: boolean }> {
  const { data } = await apiClient.get('/setup/status');
  return data;
}

export async function completeSetup(input: {
  orgName: string;
  adminDisplayName: string;
  adminEmail: string;
  adminUsername: string;
  adminPassword: string;
  smtp?: {
    enabled: boolean;
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };
}): Promise<{ success: boolean; vaultKey: string | null }> {
  const { data } = await apiClient.post('/setup/complete', input);
  return data;
}
