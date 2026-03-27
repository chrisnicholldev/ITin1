import { randomBytes } from 'crypto';
import { env } from '../../config/env.js';
import { UserRole, AuthProvider } from '@itdesk/shared';
import { User } from '../users/user.model.js';
import { issueTokens } from './auth.service.js';
import { AppError } from '../../middleware/error.middleware.js';

const MS_BASE = `https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}`;
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// Scopes: openid/profile/email for identity, User.Read for profile,
// Directory.Read.All for group membership lookup (requires admin consent in Azure portal).
const SCOPES = 'openid profile email User.Read Directory.Read.All';

export function generateState(): string {
  return randomBytes(16).toString('hex');
}

export function getAuthorizationUrl(state: string): string {
  if (!env.AZURE_AD_CLIENT_ID || !env.AZURE_AD_TENANT_ID || !env.AZURE_AD_REDIRECT_URI) {
    throw new AppError(503, 'Azure AD is not fully configured');
  }
  const params = new URLSearchParams({
    client_id: env.AZURE_AD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.AZURE_AD_REDIRECT_URI,
    scope: SCOPES,
    state,
    response_mode: 'query',
    prompt: 'select_account',
  });
  return `${MS_BASE}/oauth2/v2.0/authorize?${params}`;
}

async function exchangeCode(code: string): Promise<string> {
  const resp = await fetch(`${MS_BASE}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.AZURE_AD_CLIENT_ID!,
      client_secret: env.AZURE_AD_CLIENT_SECRET!,
      code,
      redirect_uri: env.AZURE_AD_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as Record<string, string>;
    throw new AppError(401, `Azure authentication failed: ${err['error_description'] ?? resp.statusText}`);
  }

  const data = await resp.json() as { access_token: string };
  return data.access_token;
}

async function getGraphProfile(accessToken: string): Promise<{
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  department: string | null;
  jobTitle: string | null;
}> {
  const resp = await fetch(
    `${GRAPH_BASE}/me?$select=id,displayName,mail,userPrincipalName,department,jobTitle`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!resp.ok) throw new AppError(401, 'Failed to fetch Azure AD profile');
  return resp.json() as Promise<any>;
}

async function getUserGroupIds(accessToken: string): Promise<string[]> {
  try {
    const resp = await fetch(
      `${GRAPH_BASE}/me/memberOf?$select=id`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!resp.ok) return [];
    const data = await resp.json() as { value?: Array<{ id: string }> };
    return (data.value ?? []).map((g) => g.id);
  } catch {
    return [];
  }
}

function resolveRoleFromGroups(groupIds: string[]): string {
  if (env.AZURE_AD_ADMIN_GROUP_ID && groupIds.includes(env.AZURE_AD_ADMIN_GROUP_ID)) {
    return UserRole.IT_ADMIN;
  }
  if (env.AZURE_AD_TECH_GROUP_ID && groupIds.includes(env.AZURE_AD_TECH_GROUP_ID)) {
    return UserRole.IT_TECHNICIAN;
  }
  return UserRole.END_USER;
}

export async function handleAzureCallback(code: string): Promise<{ accessToken: string; refreshToken: string }> {
  const msAccessToken = await exchangeCode(code);

  const [profile, groupIds] = await Promise.all([
    getGraphProfile(msAccessToken),
    getUserGroupIds(msAccessToken),
  ]);

  const email = (profile.mail ?? profile.userPrincipalName).toLowerCase();
  const role = resolveRoleFromGroups(groupIds);

  // Derive a username from the email local-part, but don't overwrite an
  // existing username if the account was previously created as local/LDAP.
  const existing = await User.findOne({ email });
  const localPart = email.split('@').at(0) ?? email;
  const username = existing?.username ?? localPart.toLowerCase().replace(/[^a-z0-9._-]/g, '');

  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        displayName: profile.displayName,
        username,
        authProvider: AuthProvider.AZURE_AD,
        role,
        ...(profile.department && { department: profile.department }),
        ...(profile.jobTitle && { title: profile.jobTitle }),
        azureId: profile.id,
        isActive: true,
        lastLogin: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  // Azure AD users skip app-level 2FA — Microsoft's own MFA applies.
  return issueTokens(user.id as string, user.role);
}
