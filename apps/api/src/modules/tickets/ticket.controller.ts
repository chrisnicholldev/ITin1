import type { Request, Response } from 'express';
import * as ticketService from './ticket.service.js';
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
  res.json(await ticketService.updateTicket(String(req.params['id']), input, user.role));
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
