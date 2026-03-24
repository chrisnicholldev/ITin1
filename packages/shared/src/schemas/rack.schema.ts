import { z } from 'zod';

export const CreateRackSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().min(1).max(200),
  totalU: z.coerce.number().int().min(1).max(100).default(42),
  notes: z.string().max(2000).optional(),
});

export const UpdateRackSchema = CreateRackSchema.partial();

export const CreateRackMountSchema = z.object({
  assetId: z.string().optional(),
  label: z.string().max(100).optional(), // for non-asset entries
  startU: z.coerce.number().int().min(1),
  endU: z.coerce.number().int().min(1),
  notes: z.string().max(500).optional(),
}).refine((d) => d.endU >= d.startU, {
  message: 'End U must be greater than or equal to Start U',
  path: ['endU'],
}).refine((d) => d.assetId || d.label, {
  message: 'Either an asset or a label is required',
  path: ['assetId'],
});

export const UpdateRackMountSchema = z.object({
  label: z.string().max(100).optional(),
  startU: z.coerce.number().int().min(1).optional(),
  endU: z.coerce.number().int().min(1).optional(),
  notes: z.string().max(500).optional(),
});

export const RackMountResponseSchema = z.object({
  id: z.string(),
  asset: z.object({
    id: z.string(),
    name: z.string(),
    assetTag: z.string(),
    type: z.string(),
    status: z.string(),
    manufacturer: z.string().optional(),
    modelName: z.string().optional(),
    specs: z.object({ ipAddress: z.string().optional() }).optional(),
    network: z.object({ ipAddress: z.string().optional() }).optional(),
  }).optional(),
  label: z.string().optional(),
  startU: z.number(),
  endU: z.number(),
  notes: z.string().optional(),
});

export const RackResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  totalU: z.number(),
  notes: z.string().optional(),
  mounts: z.array(RackMountResponseSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateRackInput = z.infer<typeof CreateRackSchema>;
export type UpdateRackInput = z.infer<typeof UpdateRackSchema>;
export type CreateRackMountInput = z.infer<typeof CreateRackMountSchema>;
export type UpdateRackMountInput = z.infer<typeof UpdateRackMountSchema>;
export type RackMountResponse = z.infer<typeof RackMountResponseSchema>;
export type RackResponse = z.infer<typeof RackResponseSchema>;
