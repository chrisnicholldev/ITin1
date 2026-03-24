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
