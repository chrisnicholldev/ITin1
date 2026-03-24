import { z } from 'zod';
import { TicketPrioritySchema } from './ticket.schema.js';

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  defaultPriority: TicketPrioritySchema.optional(),
  defaultAssignee: z.string().nullable().optional(),
  subcategories: z.array(z.string().min(1).max(100)).default([]),
  isActive: z.boolean().default(true),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

export const CategoryResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  defaultPriority: TicketPrioritySchema.optional(),
  defaultAssignee: z.object({ id: z.string(), displayName: z.string() }).nullable().optional(),
  subcategories: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type CategoryResponse = z.infer<typeof CategoryResponseSchema>;
