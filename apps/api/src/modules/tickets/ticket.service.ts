import mongoose from 'mongoose';
import { Ticket, type ITicketDocument } from './ticket.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateTicketInput, UpdateTicketInput, CreateCommentInput } from '@itdesk/shared';
import { TicketStatus } from '@itdesk/shared';
import { z } from 'zod';

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
  ]) as ITicketDocument;

  return toResponse(populated);
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
    .populate('assignedTo', 'displayName')
    .populate('relatedAssets', 'name assetTag') as ITicketDocument | null;

  if (!updated) throw new AppError(404, 'Ticket not found');
  return toResponse(updated);
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
  ).populate('comments.author', 'displayName avatarUrl') as ITicketDocument | null;

  if (!ticket) throw new AppError(404, 'Ticket not found');

  const comment = ticket.comments.at(-1)!;
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
