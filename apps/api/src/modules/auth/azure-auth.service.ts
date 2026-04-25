import { randomBytes } from 'crypto';
import { UserRole, AuthProvider } from '@itdesk/shared';
import { User } from '../users/user.model.js';
import { issueTokens } from './auth.service.js';
import { AppError } from '../../middleware/error.middleware.js';
import { getEntraRuntimeConfig } from '../admin/integration-config.service.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'openid profile email User.Read';

export function generateState(): string {
  return randomBytes(16).toString('hex');
}

export async function getAuthorizationUrl(state: string): Promise<string> {
  const cfg = await getEntraRuntimeConfig();
  if (!cfg.clientId || !cfg.tenantId || !cfg.redirectUri) {
    throw new AppError(503, 'Entra ID is not fully configured');
  }
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: cfg.redirectUri,
    scope: SCOPES,
    state,
    response_mode: 'query',
    prompt: 'select_account',
  });
  return `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/authorize?${params}`;
}

async function exchangeCode(code: string): Promise<string> {
  const cfg = await getEntraRuntimeConfig();
  const resp = await fetch(
    `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.clientId!,
        client_secret: cfg.clientSecret!,
        code,
        redirect_uri: cfg.redirectUri!,
        grant_type: 'authorization_code',
      }).toString(),
    },
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as Record<string, string>;
    throw new AppError(401, `Microsoft authentication failed: ${err['error_description'] ?? resp.statusText}`);
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
  if (!resp.ok) throw new AppError(401, 'Failed to fetch Microsoft profile');
  return resp.json() as Promise<any>;
}

export async function handleAzureCallback(code: string): Promise<{ accessToken: string; refreshToken: string }> {
  const msAccessToken = await exchangeCode(code);
  const profile = await getGraphProfile(msAccessToken);

  const email = (profile.mail ?? profile.userPrincipalName).toLowerCase();

  // All Entra users are end users — IT staff use local accounts
  const role = UserRole.END_USER;

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

  return issueTokens(user.id as string, user.role);
}
