import { z } from 'zod';

export const CreateNetworkSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(50),   // CIDR e.g. 10.0.1.0/24
  vlanId: z.coerce.number().int().min(1).max(4094).optional(),
  gateway: z.string().max(50).optional(),
  dnsServers: z.array(z.string().max(50)).default([]),
  dhcpEnabled: z.boolean().default(false),
  dhcpRange: z.string().max(100).optional(),  // e.g. 10.0.1.100 - 10.0.1.200
  locationId: z.string().optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
});

export const UpdateNetworkSchema = CreateNetworkSchema.partial();

export const NetworkResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  vlanId: z.number().optional(),
  gateway: z.string().optional(),
  dnsServers: z.array(z.string()),
  dhcpEnabled: z.boolean(),
  dhcpRange: z.string().optional(),
  location: z.object({ id: z.string(), name: z.string() }).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  externalSource: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateNetworkInput = z.infer<typeof CreateNetworkSchema>;
export type UpdateNetworkInput = z.infer<typeof UpdateNetworkSchema>;
export type NetworkResponse = z.infer<typeof NetworkResponseSchema>;
