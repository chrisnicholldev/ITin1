import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';
import { env } from './env.js';

const ALG = 'RS256';

let privateKey: Awaited<ReturnType<typeof importPKCS8>>;
let publicKey: Awaited<ReturnType<typeof importSPKI>>;

export async function initJwt(): Promise<void> {
  privateKey = await importPKCS8(env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n'), ALG);
  publicKey = await importSPKI(env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'), ALG);
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
