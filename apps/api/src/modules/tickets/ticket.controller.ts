import type { Request, Response } from 'express';
import { z } from 'zod';
import * as ticketService from './ticket.service.js';
import { getTicketHistory } from './ticket-history.service.js';
import { getTicketReports } from './ticket.reports.service.js';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { CreateTicketSchema, UpdateTicketSchema, CreateCommentSchema } from '@itdesk/shared';

function auth(req: Request) {
  return (req as AuthenticatedRequest).user;
}

export async function listTickets(req: Request, res: Response): Promise<void> {
  const user = auth(req);
  res.json(await ticketService.listTickets(req.query, user.role, user.id));
}

export async function getTicket(req: Request, res: Response): Promise<void> {
  const user = auth(req);
  res.json(await ticketService.getTicket(String(req.params['id']), user.role, user.id));
}

export async function createTicket(req: Request, res: Response): Promise<void> {
  const user = auth(req);
  const input = CreateTicketSchema.parse(req.body);
  res.status(201).json(await ticketService.createTicket(input, user.id));
}

export async function updateTicket(req: Request, res: Response): Promise<void> {
  const user = auth(req);
  const input = UpdateTicketSchema.parse(req.body);
  res.json(await ticketService.updateTicket(String(req.params['id']), input, user.role, user.id));
}

export async function getHistory(req: Request, res: Response): Promise<void> {
  const user = auth(req);
  res.json(await getTicketHistory(String(req.params['id']), user.role, user.id));
}

export async function addComment(req: Request, res: Response): Promise<void> {
  const user = auth(req);
  const input = CreateCommentSchema.parse(req.body);
  res.status(201).json(
    await ticketService.addComment(String(req.params['id']), input, user.id, user.role),
  );
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  const user = auth(req);
  await ticketService.deleteComment(String(req.params['id']), String(req.params['commentId']), user.id, user.role);
  res.status(204).send();
}

const BulkUpdateSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().nullable().optional(),
  assignedTeam: z.string().nullable().optional(),
});

export async function bulkUpdate(req: Request, res: Response): Promise<void> {
  const user = auth(req);
  const { ids, ...updates } = BulkUpdateSchema.parse(req.body);
  res.json(await ticketService.bulkUpdateTickets(ids, updates, user.id));
}

export async function getReports(req: Request, res: Response): Promise<void> {
  res.json(await getTicketReports());
}

export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  const user = auth(req);
  if (!req.file) { res.status(400).json({ error: 'No file provided' }); return; }
  const result = await ticketService.uploadAttachment(String(req.params['id']), req.file, user.id);
  res.status(201).json(result);
}

export async function deleteAttachment(req: Request, res: Response): Promise<void> {
  const user = auth(req);
  await ticketService.deleteAttachment(String(req.params['id']), String(req.params['aid']), user.id, user.role);
  res.status(204).send();
}
