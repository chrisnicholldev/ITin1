import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  MONGODB_URI: z.string().min(1),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
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

  VAULT_ENCRYPTION_KEY: z.string().length(64, 'VAULT_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)'),

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
