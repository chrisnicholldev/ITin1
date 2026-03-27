import { apiClient } from './client';

export interface Contact {
  id: string;
  source: 'azure_ad' | 'manual';
  displayName: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  department?: string;
  notes?: string;
  // Azure AD only
  azureId?: string;
  upn?: string;
  accountEnabled?: boolean;
  lastSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateContactInput {
  displayName: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  department?: string;
  notes?: string;
}

export async function getContacts(search?: string): Promise<Contact[]> {
  const { data } = await apiClient.get('/contacts', { params: search ? { search } : {} });
  return data.data ?? data;
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  const { data } = await apiClient.post('/contacts', input);
  return data;
}

export async function updateContact(id: string, input: Partial<CreateContactInput>): Promise<Contact> {
  const { data } = await apiClient.patch(`/contacts/${id}`, input);
  return data;
}

export async function deleteContact(id: string): Promise<void> {
  await apiClient.delete(`/contacts/${id}`);
}
