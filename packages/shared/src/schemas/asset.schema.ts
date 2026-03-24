import { z } from 'zod';
import { AssetStatus, AssetType, ExternalSource } from '../enums/index.js';

export const AssetTypeSchema = z.enum([
  AssetType.WORKSTATION,
  AssetType.LAPTOP,
  AssetType.SERVER,
  AssetType.PRINTER,
  AssetType.SWITCH,
  AssetType.ROUTER,
  AssetType.FIREWALL,
  AssetType.ACCESS_POINT,
  AssetType.PHONE,
  AssetType.SOFTWARE_LICENSE,
  AssetType.OTHER,
]);

export const AssetStatusSchema = z.enum([
  AssetStatus.ACTIVE,
  AssetStatus.INACTIVE,
  AssetStatus.DECOMMISSIONED,
  AssetStatus.IN_REPAIR,
  AssetStatus.IN_STOCK,
]);

const SpecsSchema = z.object({
  cpu: z.string().optional(),
  ram: z.string().optional(),
  storage: z.string().optional(),
  os: z.string().optional(),
  osVersion: z.string().optional(),
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
}).optional();

const LicenseSchema = z.object({
  key: z.string().optional(),
  seats: z.number().int().positive().optional(),
  seatsUsed: z.number().int().min(0).optional(),
  expiryDate: z.string().datetime().optional(),
  vendor: z.string().optional(),
}).optional();

const NetworkSchema = z.object({
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
  vlan: z.number().int().optional(),
  port: z.string().optional(),
  connectedTo: z.string().optional(),
}).optional();

export const CreateAssetSchema = z.object({
  name: z.string().min(1).max(200),
  type: AssetTypeSchema,
  status: AssetStatusSchema.default(AssetStatus.ACTIVE),
  assignedTo: z.string().nullable().optional(),
  location: z.string().max(200).optional(),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  purchaseDate: z.string().datetime().optional(),
  warrantyExpiry: z.string().datetime().optional(),
  purchaseCost: z.number().min(0).optional(),
  specs: SpecsSchema,
  license: LicenseSchema,
  network: NetworkSchema,
  notes: z.string().max(5000).optional(),
  customFields: z.record(z.unknown()).default({}),
});

export const UpdateAssetSchema = CreateAssetSchema.partial();

export const AssetResponseSchema = z.object({
  id: z.string(),
  assetTag: z.string(),
  name: z.string(),
  type: AssetTypeSchema,
  status: AssetStatusSchema,
  assignedTo: z.object({ id: z.string(), displayName: z.string(), email: z.string() }).nullable().optional(),
  location: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().datetime().optional(),
  warrantyExpiry: z.string().datetime().optional(),
  purchaseCost: z.number().optional(),
  specs: SpecsSchema,
  license: LicenseSchema,
  network: NetworkSchema,
  notes: z.string().optional(),
  externalSource: z.enum([ExternalSource.INTUNE, ExternalSource.MERAKI, ExternalSource.MANUAL]).optional(),
  externalId: z.string().optional(),
  lastSyncedAt: z.string().datetime().optional(),
  customFields: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateAssetInput = z.infer<typeof CreateAssetSchema>;
export type UpdateAssetInput = z.infer<typeof UpdateAssetSchema>;
export type AssetResponse = z.infer<typeof AssetResponseSchema>;
