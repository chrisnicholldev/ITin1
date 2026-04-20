import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { Ticket, type ITicketDocument } from './ticket.model.js';
import { Category } from '../categories/category.model.js';
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
import { recordHistory } from './ticket-history.service.js';

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
  assignedTeam: z.string().optional(),
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
    if (query.assignedTeam) filter['assignedTeam'] = new mongoose.Types.ObjectId(query.assignedTeam);
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
      .populate('assignedTeam', 'name')
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
    .populate('assignedTeam', 'name')
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
  const category = await Category.findById(input.category).select('defaultAssignee defaultPriority').lean();
  const finalAssignedTo = category?.defaultAssignee?.toString();
  const finalPriority = category?.defaultPriority ?? input.priority;

  const ticket = await Ticket.create({
    ...input,
    priority: finalPriority,
    category: new mongoose.Types.ObjectId(input.category),
    submittedBy: new mongoose.Types.ObjectId(submittedBy),
    ...(finalAssignedTo && { assignedTo: new mongoose.Types.ObjectId(finalAssignedTo) }),
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

  recordHistory(ticket.id, submittedBy, 'created');

  return response;
}

export async function updateTicket(id: string, input: UpdateTicketInput, viewerRole: string, actorId?: string) {
  const ticket = await Ticket.findById(id);
  if (!ticket) throw new AppError(404, 'Ticket not found');

  // End users can only update description on open tickets
  if (viewerRole === 'end_user') {
    if (input.status || input.assignedTo || input.priority) {
      throw new AppError(403, 'Insufficient permissions');
    }
  }

  // Diff changes for audit trail
  const trackableFields = ['status', 'priority', 'assignedTo', 'assignedTeam', 'title', 'description'] as const;
  const changes = trackableFields
    .filter((f) => input[f] !== undefined && String(input[f]) !== String((ticket as any)[f] ?? ''))
    .map((f) => ({ field: f, from: (ticket as any)[f], to: input[f] }));

  const updates: Record<string, unknown> = { ...input };

  // Convert assignedTeam string ID to ObjectId (or null to unset)
  if ('assignedTeam' in updates) {
    updates['assignedTeam'] = updates['assignedTeam']
      ? new mongoose.Types.ObjectId(updates['assignedTeam'] as string)
      : null;
  }

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
    .populate('assignedTeam', 'name')
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

  if (actorId && changes.length > 0) {
    recordHistory(id, actorId, 'updated', changes);
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

  recordHistory(id, authorId, 'comment_added');

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

  recordHistory(ticketId, userId, 'comment_deleted');
}

export async function bulkUpdateTickets(
  ids: string[],
  updates: { status?: string; priority?: string; assignedTo?: string | null; assignedTeam?: string | null },
  actorId: string,
) {
  const set: Record<string, unknown> = {};
  if (updates.status) {
    set['status'] = updates.status;
    if (updates.status === TicketStatus.RESOLVED) {
      set['resolvedAt'] = new Date();
    } else if (updates.status === TicketStatus.CLOSED) {
      set['closedAt'] = new Date();
    }
  }
  if (updates.priority) set['priority'] = updates.priority;
  if (updates.assignedTo !== undefined) set['assignedTo'] = updates.assignedTo ? new mongoose.Types.ObjectId(updates.assignedTo) : null;
  if (updates.assignedTeam !== undefined) set['assignedTeam'] = updates.assignedTeam;

  const result = await Ticket.updateMany(
    { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } },
    { $set: set },
  );

  const trackableChanges = Object.entries(updates)
    .filter(([, v]) => v !== undefined)
    .map(([field, to]) => ({ field, from: null, to }));

  for (const id of ids) {
    recordHistory(id, actorId, 'updated', trackableChanges);
  }

  return { updated: result.modifiedCount };
}

export async function uploadAttachment(
  ticketId: string,
  file: Express.Multer.File,
  uploaderId: string,
) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new AppError(404, 'Ticket not found');

  const relativePath = path.relative(process.cwd(), file.path).replace(/\\/g, '/');

  const attachment = {
    filename: file.originalname,
    storagePath: relativePath,
    mimeType: file.mimetype,
    size: file.size,
    uploadedBy: new mongoose.Types.ObjectId(uploaderId),
    uploadedAt: new Date(),
  };

  await Ticket.findByIdAndUpdate(ticketId, { $push: { attachments: attachment } });

  recordHistory(ticketId, uploaderId, 'attachment_added');

  return attachment;
}

export async function deleteAttachment(
  ticketId: string,
  attachmentId: string,
  userId: string,
  role: string,
) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new AppError(404, 'Ticket not found');

  const attachment = ticket.attachments.find((a) => a._id.toString() === attachmentId);
  if (!attachment) throw new AppError(404, 'Attachment not found');

  const isOwner = attachment.uploadedBy.toString() === userId;
  const isAdmin = ['it_admin', 'super_admin'].includes(role);
  const isTech = ['it_technician', 'it_admin', 'super_admin'].includes(role);
  if (!isOwner && !isTech && !isAdmin) throw new AppError(403, 'Cannot delete this attachment');

  try {
    await fs.unlink(path.resolve(attachment.storagePath));
  } catch {
    // File may already be gone — still clean up the DB record
  }

  await Ticket.findByIdAndUpdate(ticketId, {
    $pull: { attachments: { _id: new mongoose.Types.ObjectId(attachmentId) } },
  });

  recordHistory(ticketId, userId, 'attachment_deleted');
}
