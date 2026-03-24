import { z } from 'zod';
import { TicketPriority, TicketSource, TicketStatus } from '../enums/index.js';

export const TicketStatusSchema = z.enum([
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.PENDING,
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
]);

export const TicketPrioritySchema = z.enum([
  TicketPriority.LOW,
  TicketPriority.MEDIUM,
  TicketPriority.HIGH,
  TicketPriority.CRITICAL,
]);

export const TicketSourceSchema = z.enum([
  TicketSource.WEB,
  TicketSource.EMAIL,
  TicketSource.API,
]);

export const CreateTicketSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(1).max(10000),
  priority: TicketPrioritySchema.default(TicketPriority.MEDIUM),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  relatedAssets: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const UpdateTicketSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(1).max(10000).optional(),
  status: TicketStatusSchema.optional(),
  priority: TicketPrioritySchema.optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  assignedTo: z.string().nullable().optional(),
  assignedTeam: z.string().nullable().optional(),
  relatedAssets: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  slaDeadline: z.string().datetime().nullable().optional(),
});

export const CreateCommentSchema = z.object({
  body: z.string().min(1).max(10000),
  isInternal: z.boolean().default(false),
});

export const CommentSchema = z.object({
  id: z.string(),
  author: z.object({
    id: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().optional(),
  }),
  body: z.string(),
  isInternal: z.boolean(),
  createdAt: z.string().datetime(),
});

export const AttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  url: z.string(),
  uploadedBy: z.string(),
  uploadedAt: z.string().datetime(),
});

export const TicketResponseSchema = z.object({
  id: z.string(),
  ticketNumber: z.string(),
  title: z.string(),
  description: z.string(),
  status: TicketStatusSchema,
  priority: TicketPrioritySchema,
  source: TicketSourceSchema,
  category: z.object({ id: z.string(), name: z.string() }),
  subcategory: z.string().optional(),
  submittedBy: z.object({ id: z.string(), displayName: z.string(), email: z.string() }),
  assignedTo: z.object({ id: z.string(), displayName: z.string() }).nullable().optional(),
  assignedTeam: z.string().optional(),
  relatedAssets: z.array(z.object({ id: z.string(), name: z.string(), assetTag: z.string() })),
  comments: z.array(CommentSchema),
  attachments: z.array(AttachmentSchema),
  tags: z.array(z.string()),
  slaDeadline: z.string().datetime().nullable().optional(),
  resolvedAt: z.string().datetime().nullable().optional(),
  closedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
export type TicketResponse = z.infer<typeof TicketResponseSchema>;
export type CommentResponse = z.infer<typeof CommentSchema>;
