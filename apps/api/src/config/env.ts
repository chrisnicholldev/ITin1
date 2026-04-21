import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  CLIENT_URL: z.string().default(''),

  MONGODB_URI: z.string().min(1),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_PRIVATE_KEY: z.string().default(''),
  JWT_PUBLIC_KEY: z.string().default(''),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  LDAP_ENABLED: z.coerce.boolean().default(false),
  LDAP_URL: z.string().optional(),
  LDAP_BIND_DN: z.string().optional(),
  LDAP_BIND_CREDENTIALS: z.string().optional(),
  LDAP_SEARCH_BASE: z.string().optional(),
  LDAP_SEARCH_FILTER: z.string().default('(sAMAccountName={{username}})'),
  LDAP_ADMIN_GROUP: z.string().optional(),
  LDAP_TECH_GROUP: z.string().optional(),
  LDAP_USER_GROUP: z.string().optional(),

  SMTP_ENABLED: z.coerce.boolean().default(false),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  VAULT_ENCRYPTION_KEY: z.string().default(''),

  INTUNE_ENABLED: z.coerce.boolean().default(false),
  INTUNE_TENANT_ID: z.string().optional(),
  INTUNE_CLIENT_ID: z.string().optional(),
  INTUNE_CLIENT_SECRET: z.string().optional(),
  INTUNE_SYNC_SCHEDULE: z.string().optional(),

  MERAKI_ENABLED: z.coerce.boolean().default(false),
  MERAKI_API_KEY: z.string().optional(),
  MERAKI_ORG_ID: z.string().optional(),
  MERAKI_SYNC_SCHEDULE: z.string().optional(),

  AZURE_AD_ENABLED: z.coerce.boolean().default(false),
  AZURE_AD_CLIENT_ID: z.string().optional(),
  AZURE_AD_CLIENT_SECRET: z.string().optional(),
  AZURE_AD_TENANT_ID: z.string().optional(),
  AZURE_AD_REDIRECT_URI: z.string().optional(),
  AZURE_AD_ADMIN_GROUP_ID: z.string().optional(),
  AZURE_AD_TECH_GROUP_ID: z.string().optional(),

  COOKIE_SECURE: z.coerce.boolean().optional(),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(25),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
