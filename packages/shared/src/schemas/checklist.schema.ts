import { z } from 'zod';

export const ChecklistTypeEnum = z.enum(['onboarding', 'offboarding', 'other']);
export const ChecklistRunStatusEnum = z.enum(['in_progress', 'completed', 'cancelled']);

// ── Template schemas ──────────────────────────────────────────────────────────

export const ChecklistTemplateItemSchema = z.object({
  title:       z.string().min(1).max(300),
  description: z.string().max(1000).optional(),
  category:    z.string().max(100).optional(),
  required:    z.boolean().default(true),
});

export const CreateChecklistTemplateSchema = z.object({
  name:        z.string().min(1).max(200),
  type:        ChecklistTypeEnum.default('onboarding'),
  description: z.string().max(1000).optional(),
  items:       z.array(ChecklistTemplateItemSchema).min(1),
});

export const UpdateChecklistTemplateSchema = CreateChecklistTemplateSchema.partial();

export const ChecklistTemplateResponseSchema = z.object({
  id:          z.string(),
  name:        z.string(),
  type:        ChecklistTypeEnum,
  description: z.string().optional(),
  items:       z.array(z.object({
    id:          z.string(),
    title:       z.string(),
    description: z.string().optional(),
    category:    z.string().optional(),
    required:    z.boolean(),
  })),
  itemCount:   z.number(),
  createdAt:   z.string().datetime(),
  updatedAt:   z.string().datetime(),
});

// ── Run schemas ───────────────────────────────────────────────────────────────

export const CreateChecklistRunSchema = z.object({
  templateId:         z.string().min(1),
  employeeName:       z.string().min(1).max(200),
  employeeDepartment: z.string().max(200).optional(),
  assignedTo:         z.string().max(200).optional(),
  dueDate:            z.string().datetime().optional().or(z.literal('')),
  notes:              z.string().max(1000).optional(),
});

export const UpdateChecklistRunSchema = z.object({
  employeeName:       z.string().max(200).optional(),
  employeeDepartment: z.string().max(200).optional(),
  assignedTo:         z.string().max(200).optional(),
  dueDate:            z.string().datetime().optional().or(z.literal('')),
  notes:              z.string().max(1000).optional(),
  status:             ChecklistRunStatusEnum.optional(),
});

export const ChecklistRunResponseSchema = z.object({
  id:                 z.string(),
  templateName:       z.string(),
  type:               ChecklistTypeEnum,
  employeeName:       z.string(),
  employeeDepartment: z.string().optional(),
  assignedTo:         z.string().optional(),
  dueDate:            z.string().datetime().optional(),
  notes:              z.string().optional(),
  status:             ChecklistRunStatusEnum,
  completedAt:        z.string().datetime().optional(),
  progress:           z.object({ completed: z.number(), total: z.number(), required: z.number(), requiredCompleted: z.number() }),
  items:              z.array(z.object({
    id:          z.string(),
    title:       z.string(),
    description: z.string().optional(),
    category:    z.string().optional(),
    required:    z.boolean(),
    completed:   z.boolean(),
    completedAt: z.string().datetime().optional(),
    completedBy: z.string().optional(),
    notes:       z.string().optional(),
  })),
  createdBy:          z.object({ id: z.string(), displayName: z.string() }).optional(),
  createdAt:          z.string().datetime(),
  updatedAt:          z.string().datetime(),
});

export type ChecklistType = z.infer<typeof ChecklistTypeEnum>;
export type ChecklistRunStatus = z.infer<typeof ChecklistRunStatusEnum>;
export type CreateChecklistTemplateInput = z.infer<typeof CreateChecklistTemplateSchema>;
export type UpdateChecklistTemplateInput = z.infer<typeof UpdateChecklistTemplateSchema>;
export type ChecklistTemplateResponse = z.infer<typeof ChecklistTemplateResponseSchema>;
export type CreateChecklistRunInput = z.infer<typeof CreateChecklistRunSchema>;
export type UpdateChecklistRunInput = z.infer<typeof UpdateChecklistRunSchema>;
export type ChecklistRunResponse = z.infer<typeof ChecklistRunResponseSchema>;
