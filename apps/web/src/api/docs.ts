import { apiClient } from './client';
import type { CreateDocFolderInput, UpdateDocFolderInput, CreateArticleInput, UpdateArticleInput } from '@itdesk/shared';

export async function getFolders() {
  const { data } = await apiClient.get('/docs/folders');
  return data;
}

export async function createFolder(input: CreateDocFolderInput) {
  const { data } = await apiClient.post('/docs/folders', input);
  return data;
}

export async function updateFolder(id: string, input: UpdateDocFolderInput) {
  const { data } = await apiClient.patch(`/docs/folders/${id}`, input);
  return data;
}

export async function deleteFolder(id: string) {
  await apiClient.delete(`/docs/folders/${id}`);
}

export async function getArticles(params?: Record<string, string | number>) {
  const { data } = await apiClient.get('/docs/articles', { params });
  return data;
}

export async function getArticle(slug: string) {
  const { data } = await apiClient.get(`/docs/articles/${slug}`);
  return data;
}

export async function createArticle(input: CreateArticleInput) {
  const { data } = await apiClient.post('/docs/articles', input);
  return data;
}

export async function updateArticle(slug: string, input: UpdateArticleInput) {
  const { data } = await apiClient.patch(`/docs/articles/${slug}`, input);
  return data;
}

export async function deleteArticle(slug: string) {
  await apiClient.delete(`/docs/articles/${slug}`);
}

export async function shareArticle(slug: string, payload: { to: string; note?: string }) {
  await apiClient.post(`/docs/articles/${slug}/share`, payload);
}
