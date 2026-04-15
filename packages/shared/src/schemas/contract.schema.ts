import { z } from 'zod';

export const ContractTypeEnum = z.enum([
  'vendor_contract',
  'warranty',
  'maintenance',
  'support',
  'insurance',
  'lease',
  'other',
]);

export const ContractStatusEnum = z.enum(['active', 'expiring_soon', 'expired', 'no_expiry']);

export const CreateContractSchema = z.object({
  name: z.string().min(1).max(200),
  contractType: ContractTypeEnum.default('vendor_contract'),
  vendorId: z.string().optional(),
  vendorName: z.string().max(200).optional(),
  assetId: z.string().optional(),
  contractNumber: z.string().max(100).optional(),
  value: z.number().nonnegative().optional(),
  startDate: z.string().datetime().optional().or(z.literal('')),
  endDate: z.string().datetime().optional().or(z.literal('')),
  autoRenews: z.boolean().default(false),
  noticePeriodDays: z.number().int().nonnegative().optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  documentUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).default([]),
});

export const UpdateContractSchema = CreateContractSchema.partial();

export const ContractResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  contractType: ContractTypeEnum,
  vendor: z.object({ id: z.string(), name: z.string() }).optional(),
  vendorName: z.string().optional(),
  asset: z.object({ id: z.string(), name: z.string(), assetTag: z.string() }).optional(),
  contractNumber: z.string().optional(),
  value: z.number().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  autoRenews: z.boolean(),
  noticePeriodDays: z.number().optional(),
  noticeDueDate: z.string().datetime().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  documentUrl: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()),
  status: ContractStatusEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ContractType = z.infer<typeof ContractTypeEnum>;
export type ContractStatus = z.infer<typeof ContractStatusEnum>;
export type CreateContractInput = z.infer<typeof CreateContractSchema>;
export type UpdateContractInput = z.infer<typeof UpdateContractSchema>;
export type ContractResponse = z.infer<typeof ContractResponseSchema>;
