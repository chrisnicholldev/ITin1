# Intune Integration Setup

ITin1 syncs managed devices from Microsoft Intune via the Microsoft Graph API using OAuth2 client credentials (app-to-app, no user login required).

---

## What gets synced

Each managed device in Intune is created or updated as an asset in ITin1. Fields mapped:

| Intune field | ITin1 field |
|---|---|
| `deviceName` | `name` |
| `operatingSystem` / `deviceType` | `type` (LAPTOP, WORKSTATION, PHONE, etc.) |
| `manufacturer` | `manufacturer` |
| `model` | `modelName` |
| `serialNumber` | `serialNumber` |
| `osVersion` | `specs.osVersion` |
| `physicalMemoryInBytes` | `specs.ram` |
| `totalStorageSpaceInBytes` | `specs.storage` |
| `wiFiMacAddress` | `specs.macAddress` |
| `emailAddress` / `userDisplayName` | `customFields.assignedUser*` |
| `complianceState` | `customFields.intuneCompliance` |
| `lastSyncDateTime` | `customFields.intuneLastSync` |

Assets are matched by Intune device ID (`externalId`). Existing assets are updated; new devices create new assets with `externalSource: intune`.

Synced assets are **never deleted** by the sync — if a device is removed from Intune, its asset stays in ITin1 with its last-known data.

---

## Step 1 — Create an Azure App Registration

1. Go to [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Name it something like `ITin1 Sync`
3. Leave redirect URI blank (not needed for client credentials)
4. Click **Register**

Note the **Application (client) ID** and **Directory (tenant) ID** from the overview page.

---

## Step 2 — Add API permissions

1. In your app registration → **API permissions** → **Add a permission**
2. Choose **Microsoft Graph** → **Application permissions**
3. Search for and add each of the following:
   - `Device.Read.All` — read Azure AD registered/joined devices
   - `User.Read.All` — read registered device owners
   - `Directory.Read.All` — read directory data
   - `Group.Read.All` — read group membership
4. Click **Grant admin consent for [your tenant]** (requires a Global Admin or Intune Admin)
5. Each permission should show a green tick under Status

> **Why application permissions?** The sync runs on a schedule with no user interaction, so delegated permissions (which require a signed-in user) won't work.

> **Why these permissions?** ITin1 reads from the Azure AD devices directory (`/devices`), which covers all Azure AD joined and registered devices regardless of whether full Intune MDM enrollment is active.

---

## Step 3 — Create a client secret

1. In your app registration → **Certificates & secrets** → **New client secret**
2. Set a description (e.g. `itdesk-sync`) and an expiry (12 or 24 months)
3. **Copy the secret value immediately** — it won't be shown again

---

## Step 4 — Configure ITin1

Add to your `infra/.env` file:

```env
INTUNE_ENABLED=true
INTUNE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   # Directory (tenant) ID
INTUNE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   # Application (client) ID
INTUNE_CLIENT_SECRET=your_secret_value
INTUNE_SYNC_SCHEDULE=0 * * * *   # Cron — default is hourly
```

Restart the API container after changing `.env`:

```bash
cd infra
docker compose up -d --no-deps api
```

---

## Step 5 — Trigger a test sync

Once running, go to **Admin → Integrations** in the ITin1 UI. You should see:

- Configuration: **Configured**
- Status toggle: **Enabled**

Click **Sync Now**. After a few seconds, refresh — the sync log will show how many devices were found, created, and updated. Check **Assets** to confirm devices have appeared.

---

## Sync schedule

The default cron `0 * * * *` runs once per hour. Common alternatives:

| Schedule | Cron |
|---|---|
| Every hour | `0 * * * *` |
| Every 4 hours | `0 */4 * * *` |
| Every day at 2am | `0 2 * * *` |
| Every 30 minutes | `*/30 * * * *` |

---

## Troubleshooting

**"Intune credentials are not configured"**
: One or more of `INTUNE_TENANT_ID`, `INTUNE_CLIENT_ID`, `INTUNE_CLIENT_SECRET` is missing from `.env`.

**Sync fails with `401 Unauthorized`**
: The client secret may have expired, or admin consent hasn't been granted. Re-check Step 2 and Step 3.

**Sync fails with `403 Forbidden`**
: The `DeviceManagementManagedDevices.Read.All` permission hasn't had admin consent granted. A Global Admin or Intune Admin must click "Grant admin consent" in the Azure portal.

**Devices appear but are missing data**
: Some fields (serial number, manufacturer) depend on the Intune enrollment type and MDM profile. Corporate-enrolled devices via Autopilot will have the most complete data. BYOD/personal devices may have limited hardware info.

**Client secret about to expire**
: Create a new secret in Azure, update `INTUNE_CLIENT_SECRET` in `.env`, and restart the API container. The old secret can then be deleted.
