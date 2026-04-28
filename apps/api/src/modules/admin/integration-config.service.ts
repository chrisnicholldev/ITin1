import { IntegrationConfig, INTEGRATION_CONFIG_ID } from './integration-config.model.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { env } from '../../config/env.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function encryptField(value: string): string {
  const { iv, ciphertext, authTag } = encrypt(value);
  return JSON.stringify({ iv, ciphertext, authTag });
}

function decryptField(enc: string): string {
  const { iv, ciphertext, authTag } = JSON.parse(enc) as { iv: string; ciphertext: string; authTag: string };
  return decrypt(iv, ciphertext, authTag);
}

async function getDoc() {
  return IntegrationConfig.findById(INTEGRATION_CONFIG_ID);
}

// ── Public API (masked — for the UI) ─────────────────────────────────────────

export async function getIntegrationConfigMasked() {
  const doc = await getDoc();
  return {
    entra: {
      enabled: doc?.entra?.enabled ?? env.AZURE_AD_ENABLED,
      tenantId: doc?.entra?.tenantId ?? env.AZURE_AD_TENANT_ID ?? '',
      clientId: doc?.entra?.clientId ?? env.AZURE_AD_CLIENT_ID ?? '',
      hasClientSecret: !!(doc?.entra?.clientSecretEnc ?? env.AZURE_AD_CLIENT_SECRET),
      redirectUri: doc?.entra?.redirectUri ?? env.AZURE_AD_REDIRECT_URI ?? '',
    },
    intune: {
      enabled: doc?.intune?.enabled ?? env.INTUNE_ENABLED,
      tenantId: doc?.intune?.tenantId ?? env.INTUNE_TENANT_ID ?? '',
      clientId: doc?.intune?.clientId ?? env.INTUNE_CLIENT_ID ?? '',
      hasClientSecret: !!(doc?.intune?.clientSecretEnc ?? env.INTUNE_CLIENT_SECRET),
      syncSchedule: doc?.intune?.syncSchedule ?? env.INTUNE_SYNC_SCHEDULE ?? '',
    },
    meraki: {
      enabled: doc?.meraki?.enabled ?? env.MERAKI_ENABLED,
      hasApiKey: !!(doc?.meraki?.apiKeyEnc ?? env.MERAKI_API_KEY),
      orgId: doc?.meraki?.orgId ?? env.MERAKI_ORG_ID ?? '',
      syncSchedule: doc?.meraki?.syncSchedule ?? env.MERAKI_SYNC_SCHEDULE ?? '',
    },
    ad: {
      enabled: doc?.ad?.enabled ?? env.LDAP_ENABLED,
      url: doc?.ad?.url ?? env.LDAP_URL ?? '',
      bindDn: doc?.ad?.bindDn ?? env.LDAP_BIND_DN ?? '',
      hasBindCredentials: !!(doc?.ad?.bindCredentialsEnc ?? env.LDAP_BIND_CREDENTIALS),
      searchBase: doc?.ad?.searchBase ?? env.LDAP_SEARCH_BASE ?? '',
      computerFilter: doc?.ad?.computerFilter ?? '(objectClass=computer)',
      syncSchedule: doc?.ad?.syncSchedule ?? '',
    },
    smtp: {
      enabled: doc?.smtp?.enabled ?? env.SMTP_ENABLED,
      host: doc?.smtp?.host ?? env.SMTP_HOST ?? '',
      port: doc?.smtp?.port ?? env.SMTP_PORT ?? 587,
      user: doc?.smtp?.user ?? env.SMTP_USER ?? '',
      hasPassword: !!(doc?.smtp?.passEnc ?? env.SMTP_PASS),
      from: doc?.smtp?.from ?? env.SMTP_FROM ?? '',
    },
    imap: {
      enabled: doc?.imap?.enabled ?? false,
      host: doc?.imap?.host ?? '',
      port: doc?.imap?.port ?? 993,
      user: doc?.imap?.user ?? '',
      hasPassword: !!(doc?.imap?.passEnc),
      folder: doc?.imap?.folder ?? 'INBOX',
      defaultCategoryId: doc?.imap?.defaultCategoryId ?? '',
    },
  };
}

// ── Update functions ──────────────────────────────────────────────────────────

export async function updateIntuneConfig(input: {
  enabled?: boolean;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string; // empty = keep existing
  syncSchedule?: string;
}) {
  const existing = await getDoc();
  const update: Record<string, unknown> = { _id: INTEGRATION_CONFIG_ID };

  const intune: Record<string, unknown> = {
    enabled: input.enabled ?? existing?.intune?.enabled ?? false,
    tenantId: input.tenantId ?? existing?.intune?.tenantId,
    clientId: input.clientId ?? existing?.intune?.clientId,
    clientSecretEnc: existing?.intune?.clientSecretEnc,
    syncSchedule: input.syncSchedule ?? existing?.intune?.syncSchedule,
  };

  if (input.clientSecret?.trim()) {
    intune['clientSecretEnc'] = encryptField(input.clientSecret.trim());
  }

  update['intune'] = intune;
  if (existing) update['meraki'] = existing.meraki;

  await IntegrationConfig.findByIdAndUpdate(
    INTEGRATION_CONFIG_ID,
    { $set: update },
    { upsert: true, new: true },
  );

  return getIntegrationConfigMasked();
}

export async function updateMerakiConfig(input: {
  enabled?: boolean;
  apiKey?: string; // empty = keep existing
  orgId?: string;
  syncSchedule?: string;
}) {
  const existing = await getDoc();
  const update: Record<string, unknown> = { _id: INTEGRATION_CONFIG_ID };

  const meraki: Record<string, unknown> = {
    enabled: input.enabled ?? existing?.meraki?.enabled ?? false,
    apiKeyEnc: existing?.meraki?.apiKeyEnc,
    orgId: input.orgId ?? existing?.meraki?.orgId,
    syncSchedule: input.syncSchedule ?? existing?.meraki?.syncSchedule,
  };

  if (input.apiKey?.trim()) {
    meraki['apiKeyEnc'] = encryptField(input.apiKey.trim());
  }

  update['meraki'] = meraki;
  if (existing) update['intune'] = existing.intune;

  await IntegrationConfig.findByIdAndUpdate(
    INTEGRATION_CONFIG_ID,
    { $set: update },
    { upsert: true, new: true },
  );

  return getIntegrationConfigMasked();
}

export async function updateAdConfig(input: {
  enabled?: boolean;
  url?: string;
  bindDn?: string;
  bindCredentials?: string; // empty = keep existing
  searchBase?: string;
  computerFilter?: string;
  syncSchedule?: string;
}) {
  const existing = await getDoc();
  const update: Record<string, unknown> = { _id: INTEGRATION_CONFIG_ID };

  const ad: Record<string, unknown> = {
    enabled: input.enabled ?? existing?.ad?.enabled ?? false,
    url: input.url ?? existing?.ad?.url,
    bindDn: input.bindDn ?? existing?.ad?.bindDn,
    bindCredentialsEnc: existing?.ad?.bindCredentialsEnc,
    searchBase: input.searchBase ?? existing?.ad?.searchBase,
    computerFilter: input.computerFilter ?? existing?.ad?.computerFilter,
    syncSchedule: input.syncSchedule ?? existing?.ad?.syncSchedule,
  };

  if (input.bindCredentials?.trim()) {
    ad['bindCredentialsEnc'] = encryptField(input.bindCredentials.trim());
  }

  update['ad'] = ad;
  if (existing) {
    update['intune'] = existing.intune;
    update['meraki'] = existing.meraki;
  }

  await IntegrationConfig.findByIdAndUpdate(
    INTEGRATION_CONFIG_ID,
    { $set: update },
    { upsert: true, new: true },
  );

  return getIntegrationConfigMasked();
}

export async function updateSmtpConfig(input: {
  enabled?: boolean;
  host?: string;
  port?: number;
  user?: string;
  pass?: string; // empty = keep existing
  from?: string;
}) {
  const existing = await getDoc();
  const update: Record<string, unknown> = { _id: INTEGRATION_CONFIG_ID };

  const smtp: Record<string, unknown> = {
    enabled: input.enabled ?? existing?.smtp?.enabled ?? false,
    host: input.host ?? existing?.smtp?.host,
    port: input.port ?? existing?.smtp?.port,
    user: input.user ?? existing?.smtp?.user,
    passEnc: existing?.smtp?.passEnc,
    from: input.from ?? existing?.smtp?.from,
  };

  if (input.pass?.trim()) {
    smtp['passEnc'] = encryptField(input.pass.trim());
  }

  update['smtp'] = smtp;
  if (existing) {
    update['intune'] = existing.intune;
    update['meraki'] = existing.meraki;
    update['ad'] = existing.ad;
  }

  await IntegrationConfig.findByIdAndUpdate(
    INTEGRATION_CONFIG_ID,
    { $set: update },
    { upsert: true, new: true },
  );

  return getIntegrationConfigMasked();
}

// ── Runtime config (used by clients — DB takes precedence over env) ───────────

export async function getIntuneRuntimeConfig() {
  const doc = await getDoc();
  const tenantId = doc?.intune?.tenantId || env.INTUNE_TENANT_ID;
  const clientId = doc?.intune?.clientId || env.INTUNE_CLIENT_ID;
  const clientSecret = doc?.intune?.clientSecretEnc
    ? decryptField(doc.intune.clientSecretEnc)
    : env.INTUNE_CLIENT_SECRET;
  const enabled = doc?.intune?.enabled ?? env.INTUNE_ENABLED;
  const syncSchedule = doc?.intune?.syncSchedule || env.INTUNE_SYNC_SCHEDULE;

  return { enabled, tenantId, clientId, clientSecret, syncSchedule };
}

export async function getMerakiRuntimeConfig() {
  const doc = await getDoc();
  const apiKey = doc?.meraki?.apiKeyEnc
    ? decryptField(doc.meraki.apiKeyEnc)
    : env.MERAKI_API_KEY;
  const orgId = doc?.meraki?.orgId || env.MERAKI_ORG_ID;
  const enabled = doc?.meraki?.enabled ?? env.MERAKI_ENABLED;
  const syncSchedule = doc?.meraki?.syncSchedule || env.MERAKI_SYNC_SCHEDULE;

  return { enabled, apiKey, orgId, syncSchedule };
}

export async function getSmtpRuntimeConfig() {
  const doc = await getDoc();
  const enabled = doc?.smtp?.enabled ?? env.SMTP_ENABLED;
  const host = doc?.smtp?.host || env.SMTP_HOST;
  const port = doc?.smtp?.port ?? env.SMTP_PORT ?? 587;
  const user = doc?.smtp?.user || env.SMTP_USER;
  const pass = doc?.smtp?.passEnc ? decryptField(doc.smtp.passEnc) : env.SMTP_PASS;
  const from = doc?.smtp?.from || env.SMTP_FROM;

  return { enabled, host, port, user, pass, from };
}

export async function getAdRuntimeConfig() {
  const doc = await getDoc();
  const url = doc?.ad?.url || env.LDAP_URL;
  const bindDn = doc?.ad?.bindDn || env.LDAP_BIND_DN;
  const bindCredentials = doc?.ad?.bindCredentialsEnc
    ? decryptField(doc.ad.bindCredentialsEnc)
    : env.LDAP_BIND_CREDENTIALS;
  const searchBase = doc?.ad?.searchBase || env.LDAP_SEARCH_BASE;
  const computerFilter = doc?.ad?.computerFilter || '(objectClass=computer)';
  const syncSchedule = doc?.ad?.syncSchedule;
  const enabled = doc?.ad?.enabled ?? env.LDAP_ENABLED;

  return { enabled, url, bindDn, bindCredentials, searchBase, computerFilter, syncSchedule };
}

export async function updateImapConfig(input: {
  enabled?: boolean;
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  folder?: string;
  defaultCategoryId?: string;
}) {
  const existing = await getDoc();

  const imap: Record<string, unknown> = {
    enabled: input.enabled ?? existing?.imap?.enabled ?? false,
    host: input.host ?? existing?.imap?.host,
    port: input.port ?? existing?.imap?.port,
    user: input.user ?? existing?.imap?.user,
    passEnc: existing?.imap?.passEnc,
    folder: input.folder ?? existing?.imap?.folder ?? 'INBOX',
    defaultCategoryId: input.defaultCategoryId ?? existing?.imap?.defaultCategoryId,
  };

  if (input.pass?.trim()) {
    imap['passEnc'] = encryptField(input.pass.trim());
  }

  await IntegrationConfig.findByIdAndUpdate(
    INTEGRATION_CONFIG_ID,
    { $set: { imap } },
    { upsert: true, new: true },
  );

  return getIntegrationConfigMasked();
}

export async function updateEntraConfig(input: {
  enabled?: boolean;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string; // empty = keep existing
  redirectUri?: string;
}) {
  const existing = await getDoc();

  const entra: Record<string, unknown> = {
    enabled: input.enabled ?? existing?.entra?.enabled ?? false,
    tenantId: input.tenantId ?? existing?.entra?.tenantId,
    clientId: input.clientId ?? existing?.entra?.clientId,
    clientSecretEnc: existing?.entra?.clientSecretEnc,
    redirectUri: input.redirectUri ?? existing?.entra?.redirectUri,
  };

  if (input.clientSecret?.trim()) {
    entra['clientSecretEnc'] = encryptField(input.clientSecret.trim());
  }

  await IntegrationConfig.findByIdAndUpdate(
    INTEGRATION_CONFIG_ID,
    { $set: { entra } },
    { upsert: true, new: true },
  );

  return getIntegrationConfigMasked();
}

export async function getEntraRuntimeConfig() {
  const doc = await getDoc();
  const enabled = doc?.entra?.enabled ?? env.AZURE_AD_ENABLED;
  const tenantId = doc?.entra?.tenantId || env.AZURE_AD_TENANT_ID;
  const clientId = doc?.entra?.clientId || env.AZURE_AD_CLIENT_ID;
  const clientSecret = doc?.entra?.clientSecretEnc
    ? decryptField(doc.entra.clientSecretEnc)
    : env.AZURE_AD_CLIENT_SECRET;
  const redirectUri = doc?.entra?.redirectUri || env.AZURE_AD_REDIRECT_URI;

  return { enabled, tenantId, clientId, clientSecret, redirectUri };
}

export async function getImapRuntimeConfig() {
  const doc = await getDoc();
  const enabled = doc?.imap?.enabled ?? false;
  const host = doc?.imap?.host;
  const port = doc?.imap?.port ?? 993;
  const user = doc?.imap?.user;
  const pass = doc?.imap?.passEnc ? decryptField(doc.imap.passEnc) : undefined;
  const folder = doc?.imap?.folder ?? 'INBOX';
  const defaultCategoryId = doc?.imap?.defaultCategoryId;

  return { enabled, host, port, user, pass, folder, defaultCategoryId };
}
