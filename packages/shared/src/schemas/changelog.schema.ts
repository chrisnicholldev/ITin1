import { z } from 'zod';

export const ChangelogCategoryEnum = z.enum([
  'infrastructure',
  'network',
  'security',
  'software',
  'hardware',
  'user_management',
  'policy',
  'vendor',
  'other',
]);

export const CreateChangelogEntrySchema = z.object({
  title: z.string().min(1).max(300),
  category: ChangelogCategoryEnum.default('other'),
  description: z.string().min(1).max(5000),
  performedBy: z.string().max(200).optional(),
  occurredAt: z.string().datetime().optional().or(z.literal('')),
  affectedSystems: z.array(z.string().max(100)).default([]),
  tags: z.array(z.string().max(50)).default([]),
  rollbackNotes: z.string().max(2000).optional(),
});

export const UpdateChangelogEntrySchema = CreateChangelogEntrySchema.partial();

export const ChangelogEntryResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: ChangelogCategoryEnum,
  description: z.string(),
  performedBy: z.string().optional(),
  occurredAt: z.string().datetime(),
  affectedSystems: z.array(z.string()),
  tags: z.array(z.string()),
  rollbackNotes: z.string().optional(),
  createdBy: z.object({ id: z.string(), displayName: z.string() }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ChangelogCategory = z.infer<typeof ChangelogCategoryEnum>;
export type CreateChangelogEntryInput = z.infer<typeof CreateChangelogEntrySchema>;
export type UpdateChangelogEntryInput = z.infer<typeof UpdateChangelogEntrySchema>;
export type ChangelogEntryResponse = z.infer<typeof ChangelogEntryResponseSchema>;
