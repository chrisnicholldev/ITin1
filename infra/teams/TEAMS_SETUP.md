# ITin1 Teams App — Setup Guide

This document covers everything needed to get the ITin1 Teams tab deployed to your organisation.

---

## Prerequisites

- Access to the **Azure Portal** with an account that can edit app registrations (Application Administrator or Global Administrator)
- Access to the **Microsoft Teams Admin Center** (Teams Administrator or Global Administrator)
- SSH access to the ITin1 server
- Your ITin1 **Client ID** — find this in Azure Portal → Entra ID → App registrations → your ITin1 app → Overview → Application (client) ID

---

## Part 1 — Azure App Registration

These changes allow Teams to request a sign-in token for your users silently (no login prompt).

### 1.1 — Set the Application ID URI

1. Go to [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations**
2. Open your ITin1 app registration
3. Click **Expose an API** in the left menu
4. Next to **Application ID URI**, click **Add** (or **Edit** if already set)
5. Set the value to:
   ```
   api://itdesk.csrd.bc.ca/<YOUR_CLIENT_ID>
   ```
   Replace `<YOUR_CLIENT_ID>` with the GUID from the Overview page
6. Click **Save**

### 1.2 — Add a scope

Still on the **Expose an API** page:

1. Under **Scopes defined by this API**, click **Add a scope**
2. Fill in the fields:
   | Field | Value |
   |---|---|
   | Scope name | `access_as_user` |
   | Who can consent | Admins only |
   | Admin consent display name | `Access ITin1 as user` |
   | Admin consent description | `Allows Teams to sign users into ITin1` |
   | State | Enabled |
3. Click **Add scope**

### 1.3 — Pre-authorise Teams client applications

Still on the **Expose an API** page:

1. Under **Authorized client applications**, click **Add a client application**
2. Enter Client ID: `1fec8e78-bce4-4aaf-ab1b-5451cc387264`
3. Tick the checkbox next to your `access_as_user` scope
4. Click **Add application**
5. Repeat for Client ID: `5e3ce6c0-2b1f-4285-8d4b-75ee78787346`

> These two IDs are Microsoft's own Teams clients (web + desktop/mobile). Pre-authorising them means users won't be shown a consent prompt when the tab loads.

---

## Part 2 — Build the Teams App Package

The app package is a zip file containing three files: the manifest and two icons.

### 2.1 — Prepare the manifest

1. Open `infra/teams/manifest.json.template`
2. Make a copy named `manifest.json` in the same folder
3. Replace the following placeholders:

   | Placeholder | Replace with |
   |---|---|
   | `{{APP_ID}}` | A new random GUID — generate one at [uuidgenerator.net](https://www.uuidgenerator.net) |
   | `{{DOMAIN}}` | `itdesk.csrd.bc.ca` |
   | `{{CLIENT_ID}}` | Your Azure app's Client ID |

   Example of the completed `webApplicationInfo` section:
   ```json
   "webApplicationInfo": {
     "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
     "resource": "api://itdesk.csrd.bc.ca/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   }
   ```

### 2.2 — Prepare the icons

Teams requires two PNG icon files in the same folder as `manifest.json`:

| File | Size | Description |
|---|---|---|
| `color.png` | 192 × 192 px | Full-colour app icon — can use your organisation's logo or a simple IT icon on a dark background (`#18181b`) |
| `outline.png` | 32 × 32 px | White icon on a transparent background, used in the Teams sidebar |

> **Quick option:** Use any image editor or Canva. For `color.png`, a white ticket icon centred on a `#18181b` background works well. For `outline.png`, export a white version of the same icon at 32×32.

### 2.3 — Create the zip package

From inside `infra/teams/`:

```bash
zip itdesk-teams.zip manifest.json color.png outline.png
```

The zip must contain the three files at the root level (not inside a subfolder).

---

## Part 3 — Server: Regenerate Nginx Config

The nginx config needs a new header to allow Teams to embed the app in an iframe. The template has already been updated — you just need to regenerate `nginx.conf` from it.

SSH into the server and run:

```bash
cd /path/to/ITin1
sudo ./infra/setup-ssl.sh itdesk.csrd.bc.ca <your-email>
```

This regenerates `infra/nginx/nginx.conf` from the template and reloads nginx. The command is safe to re-run — it won't request a new certificate if the existing one is still valid.

> If you'd rather not re-run the full script, add this line manually to the HTTPS server block in `infra/nginx/nginx.conf`, then run `docker compose -p itdesk exec nginx nginx -s reload`:
> ```nginx
> add_header Content-Security-Policy "frame-ancestors 'self' https://teams.microsoft.com https://*.teams.microsoft.com https://*.office.com https://*.office365.com https://*.skype.com" always;
> ```

---

## Part 4 — Deploy the App to Teams

### 4.1 — Upload the app to your organisation

1. Go to [Teams Admin Center](https://admin.teams.microsoft.com)
2. Navigate to **Teams apps** → **Manage apps**
3. Click **Upload new app** → **Upload**
4. Select `itdesk-teams.zip`
5. The app will appear in the list with status **Allowed**

### 4.2 — Push the app to all users automatically

1. In Teams Admin Center, go to **Teams apps** → **Setup policies**
2. Click on **Global (Org-wide default)**
3. Under **Installed apps**, click **Add apps**
4. Search for **IT Helpdesk**, select it, click **Add**
5. Click **Save**

Teams will automatically install the app for all users in your tenant within 24 hours. Users will see the IT Helpdesk icon appear in their Teams sidebar without needing to do anything themselves.

> Users can also install it immediately themselves: Teams → Apps → search "IT Helpdesk" → Add.

---

## Part 5 — Verify It's Working

1. Open Teams and click the IT Helpdesk icon in the sidebar
2. The tab should load and sign you in automatically (no login prompt)
3. You should see your existing tickets listed
4. Try submitting a test ticket — it should appear in the main ITin1 app

**If the tab shows a sign-in error:**
- Confirm the Application ID URI was set correctly (Part 1.1)
- Confirm both Teams client IDs were pre-authorised (Part 1.3)
- Check that the `manifest.json` `webApplicationInfo.resource` matches the Application ID URI exactly

**If the tab shows a blank page or loading spinner that never resolves:**
- The nginx `frame-ancestors` header may not be applied — check Part 3
- Verify the domain in the manifest matches your actual domain exactly

---

## Summary Checklist

- [ ] Application ID URI set to `api://itdesk.csrd.bc.ca/<CLIENT_ID>`
- [ ] `access_as_user` scope created
- [ ] Teams web client `1fec8e78-bce4-4aaf-ab1b-5451cc387264` pre-authorised
- [ ] Teams desktop client `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` pre-authorised
- [ ] `manifest.json` created with placeholders filled in
- [ ] `color.png` (192×192) and `outline.png` (32×32) created
- [ ] `itdesk-teams.zip` built
- [ ] Nginx config regenerated on server
- [ ] App uploaded to Teams Admin Center
- [ ] App added to Global setup policy for auto-install
