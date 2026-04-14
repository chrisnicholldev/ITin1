import { apiClient } from './client';

export interface SearchResults {
  assets:   { id: string; name: string; assetTag: string; type: string; status: string }[];
  tickets:  { id: string; ticketNumber: string; title: string; status: string; priority: string }[];
  docs:     { slug: string; title: string; folder?: string }[];
  contacts: { id: string; displayName: string; email?: string; company?: string }[];
  vendors:  { id: string; name: string; type: string }[];
}

export async function globalSearch(q: string): Promise<SearchResults> {
  const { data } = await apiClient.get('/search', { params: { q } });
  return data;
}
