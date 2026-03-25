import { z } from 'zod';

export const CreateLocationSchema = z.object({
  name: z.string().min(1).max(100),
  shortCode: z.string().max(10).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const UpdateLocationSchema = CreateLocationSchema.partial();

export const LocationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortCode: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateLocationInput = z.infer<typeof CreateLocationSchema>;
export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>;
export type LocationResponse = z.infer<typeof LocationResponseSchema>;
