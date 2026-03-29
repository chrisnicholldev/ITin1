import mongoose from 'mongoose';
import { Ticket, type ITicketDocument } from './ticket.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateTicketInput, UpdateTicketInput, CreateCommentInput } from '@itdesk/shared';
import { TicketStatus } from '@itdesk/shared';
import { z } from 'zod';
import {
  notifyTicketCreated,
  notifyTicketAssigned,
  notifyStatusChanged,
  notifyCommentAdded,
} from '../notifications/notification.service.js';

function toResponse(ticket: ITicketDocument) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    source: ticket.source,
    category: ticket.category,
    subcategory: ticket.subcategory,
    submittedBy: ticket.submittedBy,
    assignedTo: ticket.assignedTo ?? null,
    assignedTeam: ticket.assignedTeam,
    relatedAssets: ticket.relatedAssets,
    comments: ticket.comments,
    attachments: ticket.attachments,
    tags: ticket.tags,
    slaDeadline: ticket.slaDeadline ?? null,
    resolvedAt: ticket.resolvedAt ?? null,
    closedAt: ticket.closedAt ?? null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  submittedBy: z.string().optional(),
});

export type ListTicketsQuery = z.infer<typeof ListQuerySchema>;

export async function listTickets(rawQuery: unknown, viewerRole: string, viewerId: string) {
  const query = ListQuerySchema.parse(rawQuery);
  const filter: Record<string, unknown> = {};

  // End users only see their own tickets
  if (viewerRole === 'end_user') {
    filter['submittedBy'] = new mongoose.Types.ObjectId(viewerId);
  } else {
    if (query.assignedTo) filter['assignedTo'] = new mongoose.Types.ObjectId(query.assignedTo);
    if (query.submittedBy) filter['submittedBy'] = new mongoose.Types.ObjectId(query.submittedBy);
    if (query.category) filter['category'] = new mongoose.Types.ObjectId(query.category);
  }

  if (query.status) filter['status'] = query.status;
  if (query.priority) filter['priority'] = query.priority;
  if (query.search) {
    filter['$or'] = [
      { title: { $regex: query.search, $options: 'i' } },
      { ticketNumber: { $regex: query.search, $options: 'i' } },
      { description: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    Ticket.find(filter)
      .populate('category', 'name')
      .populate('submittedBy', 'displayName email')
      .populate('assignedTo', 'displayName')
      .populate('relatedAssets', 'name assetTag')
      .sort({ [query.sort]: query.order === 'asc' ? 1 : -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit) as Promise<ITicketDocument[]>,
    Ticket.countDocuments(filter),
  ]);

  return {
    data: data.map(toResponse),
    meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getTicket(id: string, viewerRole: string, viewerId: string) {
  const ticket = await Ticket.findById(id)
    .populate('category', 'name')
    .populate('submittedBy', 'displayName email')
    .populate('assignedTo', 'displayName')
    .populate('relatedAssets', 'name assetTag')
    .populate('comments.author', 'displayName avatarUrl') as ITicketDocument | null;

  if (!ticket) throw new AppError(404, 'Ticket not found');

  if (viewerRole === 'end_user' && ticket.submittedBy.toString() !== viewerId) {
    throw new AppError(403, 'Access denied');
  }

  const response = toResponse(ticket);

  // Hide internal comments from end users
  if (viewerRole === 'end_user') {
    response.comments = (response.comments as Array<{ isInternal: boolean }>).filter(
      (c) => !c.isInternal,
    ) as typeof response.comments;
  }

  return response;
}

export async function createTicket(input: CreateTicketInput, submittedBy: string) {
  const ticket = await Ticket.create({
    ...input,
    category: new mongoose.Types.ObjectId(input.category),
    submittedBy: new mongoose.Types.ObjectId(submittedBy),
    relatedAssets: input.relatedAssets.map((id) => new mongoose.Types.ObjectId(id)),
  }) as ITicketDocument;

  const populated = await ticket.populate([
    { path: 'category', select: 'name' },
    { path: 'submittedBy', select: 'displayName email' },
    { path: 'assignedTo', select: 'displayName email' },
  ]) as ITicketDocument;

  const response = toResponse(populated);

  const sub = populated.submittedBy as any;
  const asgn = populated.assignedTo as any;
  const ticketInfo = { id: response.id, ticketNumber: response.ticketNumber, title: response.title, priority: response.priority, status: response.status };

  notifyTicketCreated(ticketInfo, { displayName: sub.displayName, email: sub.email }).catch(() => {});
  if (asgn) {
    notifyTicketAssigned(ticketInfo, { displayName: asgn.displayName, email: asgn.email }).catch(() => {});
  }

  return response;
}

export async function updateTicket(id: string, input: UpdateTicketInput, viewerRole: string) {
  const ticket = await Ticket.findById(id);
  if (!ticket) throw new AppError(404, 'Ticket not found');

  // End users can only update description on open tickets
  if (viewerRole === 'end_user') {
    if (input.status || input.assignedTo || input.priority) {
      throw new AppError(403, 'Insufficient permissions');
    }
  }

  const updates: Record<string, unknown> = { ...input };

  if (input.status === TicketStatus.RESOLVED && !ticket.resolvedAt) {
    updates['resolvedAt'] = new Date();
  }
  if (input.status === TicketStatus.CLOSED && !ticket.closedAt) {
    updates['closedAt'] = new Date();
  }

  const updated = await Ticket.findByIdAndUpdate(id, { $set: updates }, { new: true })
    .populate('category', 'name')
    .populate('submittedBy', 'displayName email')
    .populate('assignedTo', 'displayName email')
    .populate('relatedAssets', 'name assetTag') as ITicketDocument | null;

  if (!updated) throw new AppError(404, 'Ticket not found');

  const response = toResponse(updated);
  const sub = updated.submittedBy as any;
  const asgn = updated.assignedTo as any;
  const ticketInfo = { id: response.id, ticketNumber: response.ticketNumber, title: response.title, priority: response.priority, status: response.status };

  if (input.status && input.status !== ticket.status) {
    notifyStatusChanged(ticketInfo, { displayName: sub.displayName, email: sub.email }, input.status).catch(() => {});
  }
  if (input.assignedTo && input.assignedTo !== ticket.assignedTo?.toString() && asgn) {
    notifyTicketAssigned(ticketInfo, { displayName: asgn.displayName, email: asgn.email }).catch(() => {});
  }

  return response;
}

export async function addComment(id: string, input: CreateCommentInput, authorId: string, viewerRole: string) {
  if (input.isInternal && viewerRole === 'end_user') {
    throw new AppError(403, 'End users cannot create internal notes');
  }

  const ticket = await Ticket.findByIdAndUpdate(
    id,
    {
      $push: {
        comments: {
          author: new mongoose.Types.ObjectId(authorId),
          body: input.body,
          isInternal: input.isInternal,
          createdAt: new Date(),
        },
      },
    },
    { new: true },
  )
    .populate('comments.author', 'displayName avatarUrl')
    .populate('submittedBy', 'displayName email')
    .populate('assignedTo', 'displayName email') as ITicketDocument | null;

  if (!ticket) throw new AppError(404, 'Ticket not found');

  const comment = ticket.comments.at(-1)!;

  const sub = ticket.submittedBy as any;
  const asgn = ticket.assignedTo as any;
  const commenter = comment.author as any;
  const ticketInfo = {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    priority: ticket.priority,
    status: ticket.status,
  };

  notifyCommentAdded(
    ticketInfo,
    { displayName: commenter.displayName },
    input.body,
    input.isInternal ?? false,
    { displayName: sub.displayName, email: sub.email },
    asgn ? { displayName: asgn.displayName, email: asgn.email } : null,
  ).catch(() => {});

  return {
    id: comment._id.toString(),
    author: comment.author,
    body: comment.body,
    isInternal: comment.isInternal,
    createdAt: comment.createdAt,
  };
}

export async function deleteComment(ticketId: string, commentId: string, userId: string, role: string) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new AppError(404, 'Ticket not found');

  const comment = ticket.comments.find((c) => c._id.toString() === commentId);
  if (!comment) throw new AppError(404, 'Comment not found');

  const isAuthor = comment.author.toString() === userId;
  const isAdmin = ['it_admin', 'super_admin'].includes(role);
  if (!isAuthor && !isAdmin) throw new AppError(403, 'Cannot delete this comment');

  await Ticket.findByIdAndUpdate(ticketId, {
    $pull: { comments: { _id: new mongoose.Types.ObjectId(commentId) } },
  });
}
