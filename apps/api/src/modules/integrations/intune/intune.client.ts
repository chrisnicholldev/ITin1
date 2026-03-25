import { redis } from '../../../config/redis.js';
import { env } from '../../../config/env.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TOKEN_CACHE_KEY = 'intune:access_token';

async function getAccessToken(): Promise<string> {
  const cached = await redis.get(TOKEN_CACHE_KEY);
  if (cached) return cached;

  const url = `https://login.microsoftonline.com/${env.INTUNE_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.INTUNE_CLIENT_ID!,
    client_secret: env.INTUNE_CLIENT_SECRET!,
    scope: 'https://graph.microsoft.com/.default',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Intune token fetch failed: ${res.status} ${text}`);
  }

  const json = await res.json() as { access_token: string; expires_in: number };

  // Cache with 60s buffer before real expiry
  const ttl = json.expires_in - 60;
  await redis.set(TOKEN_CACHE_KEY, json.access_token, 'EX', ttl);

  return json.access_token;
}

// Azure AD device (from /devices endpoint — Device.Read.All)
// Works for all Azure AD joined/registered devices regardless of Intune MDM enrollment
export interface AzureDevice {
  id: string;
  displayName: string;
  operatingSystem: string;
  operatingSystemVersion: string;
  manufacturer: string;
  model: string;
  isCompliant: boolean | null;
  isManaged: boolean;
  trustType: string;           // AzureAD, ServerAD, Workplace
  approximateLastSignInDateTime: string;
  registrationDateTime: string;
  deviceId: string;            // Azure AD device ID (different from object id)
  physicalIds: string[];       // Contains serial, purchase order, ZTDID etc.
  extensionAttributes: Record<string, string | null>;
  // Populated via $expand=registeredOwners
  registeredOwners?: Array<{
    id: string;
    displayName: string;
    userPrincipalName: string;
    mail: string;
  }>;
}

async function graphPaginatedGet<T>(token: string, url: string): Promise<T[]> {
  const items: T[] = [];
  let next: string | null = url;

  while (next) {
    const res = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph API request failed: ${res.status} ${text}`);
    }

    const json = await res.json() as { value: T[]; '@odata.nextLink'?: string };
    items.push(...json.value);
    next = json['@odata.nextLink'] ?? null;
  }

  return items;
}

export interface AzureUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
  department: string;
  jobTitle: string;
  accountEnabled: boolean;
}

export async function getAzureUsers(): Promise<AzureUser[]> {
  const token = await getAccessToken();

  const url =
    `${GRAPH_BASE}/users` +
    `?$select=id,displayName,userPrincipalName,mail,department,jobTitle,accountEnabled` +
    `&$filter=accountEnabled eq true` +
    `&$top=999`;

  return graphPaginatedGet<AzureUser>(token, url);
}

export async function getManagedDevices(): Promise<AzureDevice[]> {
  const token = await getAccessToken();

  // Simplified query — no nested $select in $expand as some tenants reject that syntax
  const url =
    `${GRAPH_BASE}/devices` +
    `?$select=id,displayName,operatingSystem,operatingSystemVersion,manufacturer,model,` +
    `isCompliant,isManaged,trustType,approximateLastSignInDateTime,registrationDateTime,` +
    `deviceId,physicalIds` +
    `&$expand=registeredOwners` +
    `&$top=999`;

  return graphPaginatedGet<AzureDevice>(token, url);
}
