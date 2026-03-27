import { apiClient } from './client';
import type { CreateCategoryInput, UpdateCategoryInput, CategoryResponse } from '@itdesk/shared';

export async function getCategories(activeOnly = true): Promise<CategoryResponse[]> {
  const { data } = await apiClient.get('/categories', { params: { activeOnly } });
  return data;
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryResponse> {
  const { data } = await apiClient.post('/categories', input);
  return data;
}

export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<CategoryResponse> {
  const { data } = await apiClient.patch(`/categories/${id}`, input);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`);
}
