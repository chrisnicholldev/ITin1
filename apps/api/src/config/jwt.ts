import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';
import { env } from './env.js';
import { getJwtPrivateKey, getJwtPublicKey } from '../lib/secrets.js';

const ALG = 'RS256';

let privateKey: Awaited<ReturnType<typeof importPKCS8>>;
let publicKey: Awaited<ReturnType<typeof importSPKI>>;

export async function initJwt(): Promise<void> {
  privateKey = await importPKCS8(getJwtPrivateKey(), ALG);
  publicKey = await importSPKI(getJwtPublicKey(), ALG);
}

export async function signAccessToken(payload: { sub: string; role: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
    .sign(privateKey);
}

export async function verifyAccessToken(token: string): Promise<{ sub: string; role: string }> {
  const { payload } = await jwtVerify(token, publicKey);
  return payload as { sub: string; role: string };
}

/** Short-lived token issued after password check, consumed by the 2FA verify step. */
export async function signTempToken(payload: { sub: string; role: string; purpose: '2fa' }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(privateKey);
}

export async function verifyTempToken(token: string): Promise<{ sub: string; role: string; purpose: string }> {
  const { payload } = await jwtVerify(token, publicKey);
  const p = payload as { sub: string; role: string; purpose: string };
  if (p.purpose !== '2fa') throw new Error('Invalid token purpose');
  return p;
}
