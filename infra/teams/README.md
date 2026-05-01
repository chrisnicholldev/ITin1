# Teams App Package

## Building the package

1. Copy `manifest.json.template` to `manifest.json` and replace the placeholders:
   - `{{APP_ID}}` — generate a new GUID (e.g. `uuidgen` or any online generator)
   - `{{DOMAIN}}` — `itdesk.csrd.bc.ca`
   - `{{CLIENT_ID}}` — your Azure app registration client ID (from Entra ID)

2. Add two PNG icon files:
   - `color.png` — 192×192 px, full-colour app icon
   - `outline.png` — 32×32 px, white/transparent outline version

3. Zip the three files together (manifest + 2 icons):
   ```bash
   zip itdesk-teams.zip manifest.json color.png outline.png
   ```

4. Upload `itdesk-teams.zip` to Teams Admin Center → Teams apps → Manage apps → Upload.

## Azure app registration — required changes for SSO

Before the Teams SSO token exchange will work, your Azure app registration needs:

1. **Application ID URI** — set to `api://itdesk.csrd.bc.ca/{{CLIENT_ID}}`
   - Azure Portal → Entra ID → App registrations → your app → Expose an API → Set Application ID URI

2. **Add a scope** — `access_as_user` (or any name)
   - Under "Expose an API" → Add a scope
   - Scope name: `access_as_user`, Admin consent only, enabled

3. **Pre-authorize Teams client apps** (allows Teams to get tokens without user consent prompts)
   - Under "Expose an API" → Add a client application
   - Add both of these Teams client IDs:
     - `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams web)
     - `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams desktop/mobile)
   - Authorise for the `access_as_user` scope

## Nginx config

The `nginx-ssl.conf.template` already includes the required `frame-ancestors` header.
Re-run `./infra/setup-ssl.sh` to regenerate `nginx.conf` with this header, then reload nginx.

## Deploying to all users

In Teams Admin Center → Teams apps → Manage apps → find your app → Setup policies → add to Global policy with auto-install enabled.
