import { apiClient } from './client';
import type {
  ChecklistTemplateResponse, ChecklistRunResponse,
  CreateChecklistTemplateInput, UpdateChecklistTemplateInput,
  CreateChecklistRunInput, UpdateChecklistRunInput,
} from '@itdesk/shared';

export type { ChecklistTemplateResponse as ChecklistTemplate, ChecklistRunResponse as ChecklistRun };

// ── Templates ─────────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<ChecklistTemplateResponse[]> {
  const { data } = await apiClient.get('/checklists/templates');
  return data;
}

export async function createTemplate(input: CreateChecklistTemplateInput): Promise<ChecklistTemplateResponse> {
  const { data } = await apiClient.post('/checklists/templates', input);
  return data;
}

export async function updateTemplate(id: string, input: UpdateChecklistTemplateInput): Promise<ChecklistTemplateResponse> {
  const { data } = await apiClient.patch(`/checklists/templates/${id}`, input);
  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiClient.delete(`/checklists/templates/${id}`);
}

// ── Runs ──────────────────────────────────────────────────────────────────────

export async function getRuns(params?: { status?: string; type?: string }): Promise<ChecklistRunResponse[]> {
  const { data } = await apiClient.get('/checklists/runs', { params });
  return data;
}

export async function createRun(input: CreateChecklistRunInput): Promise<ChecklistRunResponse> {
  const { data } = await apiClient.post('/checklists/runs', input);
  return data;
}

export async function updateRun(id: string, input: UpdateChecklistRunInput): Promise<ChecklistRunResponse> {
  const { data } = await apiClient.patch(`/checklists/runs/${id}`, input);
  return data;
}

export async function deleteRun(id: string): Promise<void> {
  await apiClient.delete(`/checklists/runs/${id}`);
}

export async function toggleItem(runId: string, itemId: string): Promise<ChecklistRunResponse> {
  const { data } = await apiClient.post(`/checklists/runs/${runId}/items/${itemId}/toggle`);
  return data;
}

export async function updateItemNotes(runId: string, itemId: string, notes: string): Promise<ChecklistRunResponse> {
  const { data } = await apiClient.patch(`/checklists/runs/${runId}/items/${itemId}/notes`, { notes });
  return data;
}
