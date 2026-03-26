import { z } from 'zod';
import { VendorType } from '../enums/index.js';

export const VendorContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  title: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  isPrimary: z.boolean().default(false),
});

export const CreateVendorSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(Object.values(VendorType) as [string, ...string[]]),
  website: z.string().max(200).optional(),
  supportPhone: z.string().max(50).optional(),
  supportEmail: z.string().max(200).optional(),
  accountNumber: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
});

export const UpdateVendorSchema = CreateVendorSchema.partial();

export const VendorResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  website: z.string().optional(),
  supportPhone: z.string().optional(),
  supportEmail: z.string().optional(),
  accountNumber: z.string().optional(),
  notes: z.string().optional(),
  contacts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    title: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    notes: z.string().optional(),
    isPrimary: z.boolean(),
  })),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type VendorContactInput = z.infer<typeof VendorContactSchema>;
export type CreateVendorInput = z.infer<typeof CreateVendorSchema>;
export type UpdateVendorInput = z.infer<typeof UpdateVendorSchema>;
export type VendorResponse = z.infer<typeof VendorResponseSchema>;
