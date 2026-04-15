import { apiClient } from './client';
import type { ChangelogEntryResponse, CreateChangelogEntryInput, UpdateChangelogEntryInput } from '@itdesk/shared';

export type { ChangelogEntryResponse as ChangelogEntry };

export interface ChangelogListResponse {
  data: ChangelogEntryResponse[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function getChangelogEntries(params?: {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ChangelogListResponse> {
  const { data } = await apiClient.get('/changelog', { params });
  return data;
}

export async function createChangelogEntry(input: CreateChangelogEntryInput): Promise<ChangelogEntryResponse> {
  const { data } = await apiClient.post('/changelog', input);
  return data;
}

export async function updateChangelogEntry(id: string, input: UpdateChangelogEntryInput): Promise<ChangelogEntryResponse> {
  const { data } = await apiClient.patch(`/changelog/${id}`, input);
  return data;
}

export async function deleteChangelogEntry(id: string): Promise<void> {
  await apiClient.delete(`/changelog/${id}`);
}
