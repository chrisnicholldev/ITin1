export const TicketStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  PENDING: 'pending',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

export const TicketSource = {
  WEB: 'web',
  EMAIL: 'email',
  API: 'api',
} as const;
export type TicketSource = (typeof TicketSource)[keyof typeof TicketSource];

export const UserRole = {
  END_USER: 'end_user',
  IT_TECHNICIAN: 'it_technician',
  IT_ADMIN: 'it_admin',
  SUPER_ADMIN: 'super_admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AuthProvider = {
  LDAP: 'ldap',
  LOCAL: 'local',
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export const AssetType = {
  WORKSTATION: 'workstation',
  LAPTOP: 'laptop',
  SERVER: 'server',
  PRINTER: 'printer',
  SWITCH: 'switch',
  ROUTER: 'router',
  FIREWALL: 'firewall',
  ACCESS_POINT: 'access_point',
  PHONE: 'phone',
  SOFTWARE_LICENSE: 'software_license',
  OTHER: 'other',
} as const;
export type AssetType = (typeof AssetType)[keyof typeof AssetType];

export const AssetStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DECOMMISSIONED: 'decommissioned',
  IN_REPAIR: 'in_repair',
  IN_STOCK: 'in_stock',
} as const;
export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

export const RackMountType = {
  ASSET: 'asset',
  PATCH_PANEL: 'patch_panel',
  BLANK: 'blank',
  CABLE_MANAGEMENT: 'cable_management',
} as const;
export type RackMountType = (typeof RackMountType)[keyof typeof RackMountType];

export const CredentialCategory = {
  SERVICE_ACCOUNT: 'service_account',
  DEVICE: 'device',
  SHARED_ACCOUNT: 'shared_account',
  API_KEY: 'api_key',
  OTHER: 'other',
} as const;
export type CredentialCategory = (typeof CredentialCategory)[keyof typeof CredentialCategory];

export const VaultAccessLevel = {
  STAFF: 'staff',
  ADMIN: 'admin',
  RESTRICTED: 'restricted',
} as const;
export type VaultAccessLevel = (typeof VaultAccessLevel)[keyof typeof VaultAccessLevel];

export const VaultAuditAction = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  VIEW: 'view',
  COPY: 'copy',
} as const;
export type VaultAuditAction = (typeof VaultAuditAction)[keyof typeof VaultAuditAction];

export const ExternalSource = {
  INTUNE: 'intune',
  MERAKI: 'meraki',
  MANUAL: 'manual',
} as const;
export type ExternalSource = (typeof ExternalSource)[keyof typeof ExternalSource];
