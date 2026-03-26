import { z } from 'zod';
import { CredentialCategory, VaultAccessLevel } from '../enums/index.js';

export const CredentialCategorySchema = z.enum([
  CredentialCategory.SERVICE_ACCOUNT,
  CredentialCategory.DEVICE,
  CredentialCategory.SHARED_ACCOUNT,
  CredentialCategory.API_KEY,
  CredentialCategory.OTHER,
]);

export const CreateCredentialSchema = z.object({
  title: z.string().min(1).max(200),
  username: z.string().max(200).optional(),
  password: z.string().min(1),
  url: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  category: CredentialCategorySchema.default(CredentialCategory.OTHER),
  linkedAsset: z.string().optional(),
  linkedVendor: z.string().optional(),
  tags: z.array(z.string().max(50)).default([]),
  accessLevel: z.enum([VaultAccessLevel.STAFF, VaultAccessLevel.ADMIN, VaultAccessLevel.RESTRICTED]).default(VaultAccessLevel.STAFF),
  allowedUsers: z.array(z.string()).default([]),
});

export const UpdateCredentialSchema = CreateCredentialSchema.partial();

export const CredentialResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  username: z.string().optional(),
  url: z.string().optional(),
  notes: z.string().optional(),
  category: CredentialCategorySchema,
  linkedAsset: z.object({ id: z.string(), name: z.string(), assetTag: z.string() }).optional(),
  linkedVendor: z.object({ id: z.string(), name: z.string() }).optional(),
  tags: z.array(z.string()),
  accessLevel: z.enum([VaultAccessLevel.STAFF, VaultAccessLevel.ADMIN, VaultAccessLevel.RESTRICTED]),
  allowedUsers: z.array(z.object({ id: z.string(), displayName: z.string(), email: z.string() })),
  createdBy: z.object({ id: z.string(), displayName: z.string() }),
  updatedBy: z.object({ id: z.string(), displayName: z.string() }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const VaultAuditLogSchema = z.object({
  id: z.string(),
  credential: z.object({ id: z.string(), title: z.string() }),
  user: z.object({ id: z.string(), displayName: z.string() }),
  action: z.string(),
  ip: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type CreateCredentialInput = z.infer<typeof CreateCredentialSchema>;
export type UpdateCredentialInput = z.infer<typeof UpdateCredentialSchema>;
export type CredentialResponse = z.infer<typeof CredentialResponseSchema>;
export type VaultAuditLogEntry = z.infer<typeof VaultAuditLogSchema>;
