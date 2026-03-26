import { apiClient } from './client';

export async function downloadBackup(): Promise<void> {
  const response = await apiClient.get('/admin/backup', { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
  const today = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `itdesk-backup-${today}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function uploadRestore(file: File): Promise<{ success: boolean; total: number; collections: Record<string, number> }> {
  const text = await file.text();
  const json = JSON.parse(text);
  const { data } = await apiClient.post('/admin/restore', json, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 120_000,
  });
  return data;
}
