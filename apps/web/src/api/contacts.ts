import { apiClient } from './client';

export interface Contact {
  _id: string;
  displayName: string;
  email?: string;
  upn?: string;
  department?: string;
  jobTitle?: string;
  accountEnabled: boolean;
  lastSyncedAt?: string;
}

export async function searchContacts(search: string): Promise<Contact[]> {
  const { data } = await apiClient.get('/contacts', { params: { search, limit: 20 } });
  return data.data ?? data;
}
