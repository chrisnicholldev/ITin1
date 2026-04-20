import { generateKeyPairSync, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { env } from '../config/env.js';

const SECRETS_DIR = process.env['SECRETS_DIR'] ?? '/app/data';
const SECRETS_FILE = `${SECRETS_DIR}/secrets.json`;

interface SecretsFile {
  jwtPrivateKey: string;
  jwtPublicKey: string;
  vaultEncryptionKey: string;
}

let _loaded: SecretsFile | null = null;

export async function ensureSecrets(): Promise<void> {
  let existing: Partial<SecretsFile> = {};

  if (existsSync(SECRETS_FILE)) {
    try {
      existing = JSON.parse(readFileSync(SECRETS_FILE, 'utf-8')) as Partial<SecretsFile>;
    } catch {
      console.warn('[secrets] secrets.json is corrupt — regenerating');
    }
  }

  let changed = false;

  if (!existing.jwtPrivateKey || !existing.jwtPublicKey) {
    console.log('[secrets] Generating RSA-2048 key pair…');
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    existing.jwtPrivateKey = privateKey;
    existing.jwtPublicKey = publicKey;
    changed = true;
  }

  if (!existing.vaultEncryptionKey) {
    existing.vaultEncryptionKey = randomBytes(32).toString('hex');
    console.log('[secrets] Generated vault encryption key');
    changed = true;
  }

  if (changed) {
    mkdirSync(SECRETS_DIR, { recursive: true });
    writeFileSync(SECRETS_FILE, JSON.stringify(existing, null, 2), { mode: 0o600 });
    console.log(`[secrets] Secrets saved to ${SECRETS_FILE}`);
  }

  _loaded = existing as SecretsFile;
}

export function getJwtPrivateKey(): string {
  if (env.JWT_PRIVATE_KEY) return env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
  if (_loaded?.jwtPrivateKey) return _loaded.jwtPrivateKey;
  throw new Error('[secrets] JWT private key not available — was ensureSecrets() called?');
}

export function getJwtPublicKey(): string {
  if (env.JWT_PUBLIC_KEY) return env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
  if (_loaded?.jwtPublicKey) return _loaded.jwtPublicKey;
  throw new Error('[secrets] JWT public key not available — was ensureSecrets() called?');
}

export function getVaultKey(): string {
  if (env.VAULT_ENCRYPTION_KEY) return env.VAULT_ENCRYPTION_KEY;
  if (_loaded?.vaultEncryptionKey) return _loaded.vaultEncryptionKey;
  throw new Error('[secrets] Vault key not available — was ensureSecrets() called?');
}

/** Returns null when vault key was supplied via env (operator manages their own backup). */
export function getGeneratedVaultKey(): string | null {
  if (env.VAULT_ENCRYPTION_KEY) return null;
  return _loaded?.vaultEncryptionKey ?? null;
}
