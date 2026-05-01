import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { getEntraRuntimeConfig } from '../admin/integration-config.service.js';
import { AppError } from '../../middleware/error.middleware.js';
import { AuthProvider, UserRole } from '@itdesk/shared';
import { User } from '../users/user.model.js';
import { issueTokens } from './auth.service.js';

export async function handleTeamsSso(token: string): Promise<{ accessToken: string; refreshToken: string }> {
  const cfg = await getEntraRuntimeConfig();
  if (!cfg.clientId || !cfg.tenantId) {
    throw new AppError(503, 'Entra ID is not configured');
  }

  const jwks = createRemoteJWKSet(
    new URL(`https://login.microsoftonline.com/${cfg.tenantId}/discovery/v2.0/keys`),
  );

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      audience: cfg.clientId,
      issuer: `https://login.microsoftonline.com/${cfg.tenantId}/v2.0`,
    }));
  } catch (err: any) {
    throw new AppError(401, `Invalid Teams SSO token: ${err?.message ?? 'verification failed'}`);
  }

  const azureId = payload['oid'] as string | undefined;
  const email = ((payload['preferred_username'] as string | undefined) ?? (payload['upn'] as string | undefined) ?? '').toLowerCase();
  const displayName = (payload['name'] as string | undefined) ?? email;

  if (!azureId || !email) {
    throw new AppError(401, 'Teams token missing required claims (oid, preferred_username)');
  }

  const localPart = email.split('@')[0] ?? email;
  const username = localPart.toLowerCase().replace(/[^a-z0-9._-]/g, '');

  // Find by azureId first, fall back to email (covers accounts created before azureId was stored)
  const existing = await User.findOne({ $or: [{ azureId }, { email }] });

  if (existing) {
    const updates: Record<string, unknown> = { displayName, azureId, lastLogin: new Date() };
    // Only sync email for non-local accounts
    if (existing.authProvider !== AuthProvider.LOCAL) {
      updates['email'] = email;
    }
    await User.findByIdAndUpdate(existing._id, { $set: updates });
    return issueTokens(existing.id as string, existing.role);
  }

  // New user — create as Entra end user
  const user = await User.create({
    azureId,
    email,
    displayName,
    username,
    authProvider: AuthProvider.AZURE_AD,
    role: UserRole.END_USER,
    isActive: true,
    lastLogin: new Date(),
  });

  return issueTokens(user.id as string, user.role);
}
