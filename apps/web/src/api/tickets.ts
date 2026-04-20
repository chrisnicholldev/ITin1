import { apiClient } from './client';
import type { CreateTicketInput, UpdateTicketInput, CreateCommentInput } from '@itdesk/shared';

export async function getTickets(params?: Record<string, string | number>) {
  const { data } = await apiClient.get('/tickets', { params });
  return data;
}

export async function getTicket(id: string) {
  const { data } = await apiClient.get(`/tickets/${id}`);
  return data;
}

export async function createTicket(input: CreateTicketInput) {
  const { data } = await apiClient.post('/tickets', input);
  return data;
}

export async function updateTicket(id: string, input: UpdateTicketInput) {
  const { data } = await apiClient.patch(`/tickets/${id}`, input);
  return data;
}

export async function addComment(id: string, input: CreateCommentInput) {
  const { data } = await apiClient.post(`/tickets/${id}/comments`, input);
  return data;
}

export async function deleteComment(ticketId: string, commentId: string) {
  await apiClient.delete(`/tickets/${ticketId}/comments/${commentId}`);
}

export async function getTicketHistory(id: string) {
  const { data } = await apiClient.get(`/tickets/${id}/history`);
  return data;
}

export async function uploadAttachment(ticketId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post(`/tickets/${ticketId}/attachments`, form);
  return data;
}

export async function deleteAttachment(ticketId: string, attachmentId: string) {
  await apiClient.delete(`/tickets/${ticketId}/attachments/${attachmentId}`);
}

export async function bulkUpdateTickets(ids: string[], updates: Record<string, string>) {
  const { data } = await apiClient.post('/tickets/bulk', { ids, ...updates });
  return data;
}

export async function getTicketReports() {
  const { data } = await apiClient.get('/tickets/reports');
  return data;
}

export async function getCannedResponses(categoryId?: string) {
  const { data } = await apiClient.get('/canned-responses', { params: categoryId ? { category: categoryId } : undefined });
  return data;
}

export async function createCannedResponse(input: { title: string; body: string; categoryId?: string }) {
  const { data } = await apiClient.post('/canned-responses', input);
  return data;
}

export async function updateCannedResponse(id: string, input: { title?: string; body?: string; categoryId?: string }) {
  const { data } = await apiClient.patch(`/canned-responses/${id}`, input);
  return data;
}

export async function deleteCannedResponse(id: string) {
  await apiClient.delete(`/canned-responses/${id}`);
}
