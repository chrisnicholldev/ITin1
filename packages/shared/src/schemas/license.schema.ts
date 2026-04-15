import { z } from 'zod';

export const LicenseTypeEnum = z.enum(['subscription', 'perpetual', 'oem', 'volume', 'freeware', 'open_source']);
export const BillingCycleEnum = z.enum(['monthly', 'annually', 'one_time']);
export const LicenseStatusEnum = z.enum(['active', 'expiring_soon', 'expired', 'no_expiry']);

export const CreateLicenseSchema = z.object({
  name: z.string().min(1).max(200),
  vendor: z.string().max(200).optional(),
  licenseType: LicenseTypeEnum.default('subscription'),
  seats: z.number().int().positive().optional(),
  cost: z.number().nonnegative().optional(),
  billingCycle: BillingCycleEnum.optional(),
  purchasedAt: z.string().datetime().optional().or(z.literal('')),
  renewalDate: z.string().datetime().optional().or(z.literal('')),
  licenseKey: z.string().max(1000).optional(),
  assignedTo: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).default([]),
});

export const UpdateLicenseSchema = CreateLicenseSchema.partial();

export const LicenseResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  vendor: z.string().optional(),
  licenseType: LicenseTypeEnum,
  seats: z.number().optional(),
  cost: z.number().optional(),
  billingCycle: BillingCycleEnum.optional(),
  purchasedAt: z.string().datetime().optional(),
  renewalDate: z.string().datetime().optional(),
  licenseKey: z.string().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()),
  status: LicenseStatusEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type LicenseType = z.infer<typeof LicenseTypeEnum>;
export type BillingCycle = z.infer<typeof BillingCycleEnum>;
export type LicenseStatus = z.infer<typeof LicenseStatusEnum>;
export type CreateLicenseInput = z.infer<typeof CreateLicenseSchema>;
export type UpdateLicenseInput = z.infer<typeof UpdateLicenseSchema>;
export type LicenseResponse = z.infer<typeof LicenseResponseSchema>;
