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

// ── Runtime config (used by clients — DB takes precedence over env) ───────────

export async function getIntuneRuntimeConfig() {
  const doc = await getDoc();
  const tenantId = doc?.intune?.tenantId || env.INTUNE_TENANT_ID;
  const clientId = doc?.intune?.clientId || env.INTUNE_CLIENT_ID;
  const clientSecret = doc?.intune?.clientSecretEnc
    ? decryptField(doc.intune.clientSecretEnc)
    : env.INTUNE_CLIENT_SECRET;
  const enabled = doc?.intune?.enabled ?? env.INTUNE_ENABLED;

  return { enabled, tenantId, clientId, clientSecret };
}

export async function getMerakiRuntimeConfig() {
  const doc = await getDoc();
  const apiKey = doc?.meraki?.apiKeyEnc
    ? decryptField(doc.meraki.apiKeyEnc)
    : env.MERAKI_API_KEY;
  const orgId = doc?.meraki?.orgId || env.MERAKI_ORG_ID;
  const enabled = doc?.meraki?.enabled ?? env.MERAKI_ENABLED;

  return { enabled, apiKey, orgId };
}
