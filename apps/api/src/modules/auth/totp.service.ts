import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';
import { randomBytes, createHash } from 'crypto';

const ISSUER = 'ITin1';

export function generateSecret(): string {
  return new Secret({ size: 20 }).base32;
}

function makeTOTP(secret: string, label: string) {
  return new TOTP({ issuer: ISSUER, label, algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });
}

export function verifyTOTP(secret: string, token: string): boolean {
  const delta = makeTOTP(secret, '').validate({ token, window: 1 });
  return delta !== null;
}

export async function generateQRCodeDataUrl(secret: string, label: string): Promise<string> {
  return QRCode.toDataURL(makeTOTP(secret, label).toString());
}

export function generateRecoveryCodes(count = 8): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < count; i++) {
    // Format: XXXXX-XXXXX (10 hex chars, easier to read)
    const raw = randomBytes(5).toString('hex').toUpperCase();
    const code = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    plain.push(code);
    hashed.push(hashRecoveryCode(code));
  }
  return { plain, hashed };
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.replace(/-/g, '').toUpperCase().trim()).digest('hex');
}
