# ITin1 — Developer Manual

A complete reference for understanding, maintaining, and extending the ITin1 codebase. Written for the person who built it and anyone who needs to take it over.

---

## Table of contents

1. [Overview](#1-overview)
2. [Tech stack](#2-tech-stack)
3. [Repository layout](#3-repository-layout)
4. [Infrastructure](#4-infrastructure)
5. [Environment variables](#5-environment-variables)
6. [The shared package](#6-the-shared-package)
7. [API architecture](#7-api-architecture)
8. [Authentication & authorisation](#8-authentication--authorisation)
9. [Encryption](#9-encryption)
10. [Feature modules](#10-feature-modules)
11. [Background jobs](#11-background-jobs)
12. [Frontend architecture](#12-frontend-architecture)
13. [UI conventions](#13-ui-conventions)
14. [Adding a new feature end-to-end](#14-adding-a-new-feature-end-to-end)
15. [Common patterns & gotchas](#15-common-patterns--gotchas)
16. [Operations & maintenance](#16-operations--maintenance)

---

## 1. Overview

ITin1 is a self-hosted IT management platform. It is a monorepo containing three packages:

- **`apps/api`** — a Node.js/Express REST API
- **`apps/web`** — a React single-page application
- **`packages/shared`** — Zod schemas and TypeScript types shared between the two apps

In production, both the API and web are built into Docker images and run behind Nginx as a reverse proxy. MongoDB stores all application data. Redis backs the BullMQ job queue for scheduled alerts and integration syncs.

---

## 2. Tech stack

| Concern | Technology |
|---|---|
| Runtime | Node.js 20+ |
| API framework | Express 5 with `express-async-errors` |
| Language | TypeScript (strict mode throughout) |
| Database | MongoDB 7 via Mongoose |
| Job queue | BullMQ backed by Redis 7 |
| Auth | JWT RS256 access tokens + HttpOnly refresh token cookie |
| Encryption | AES-256-GCM via Node.js built-in `crypto` |
| Frontend | React 18, React Router v6, TanStack Query v5 |
| UI components | shadcn/ui (Radix primitives + Tailwind CSS) |
| State management | Zustand (auth state only) |
| Validation | Zod (shared between API and web) |
| Monorepo tooling | pnpm workspaces + Turborepo |
| Containerisation | Docker Compose + Nginx |

---

## 3. Repository layout

```
ITin1/
├── apps/
│   ├── api/                        # Express API application
│   │   ├── src/
│   │   │   ├── app.ts              # Express app factory — registers all routes
│   │   │   ├── server.ts           # Entry point — connects DB, starts server, starts workers
│   │   │   ├── config/
│   │   │   │   ├── env.ts          # Zod-validated environment variables
│   │   │   │   └── jwt.ts          # JWT sign/verify helpers
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts   # requireAuth, requireAdmin, requireTech
│   │   │   │   └── error.middleware.ts  # AppError class + global error handler
│   │   │   ├── lib/
│   │   │   │   ├── crypto.ts       # AES-256-GCM encrypt/decrypt
│   │   │   │   └── email.ts        # Nodemailer send helper
│   │   │   ├── jobs/
│   │   │   │   └── queues.ts       # All BullMQ queues and workers
│   │   │   └── modules/            # Feature modules (one directory per feature)
│   │   ├── Dockerfile
│   │   └── .env.example
│   │
│   └── web/                        # React frontend
│       └── src/
│           ├── api/                # Typed API client functions (one file per feature)
│           ├── components/
│           │   ├── ui/             # shadcn/ui components (do not edit these)
│           │   ├── layout/         # AppShell, ProtectedRoute, SetupGuard
│           │   └── <feature>/      # Feature-specific components
│           ├── pages/              # Page components (one directory per feature)
│           ├── stores/
│           │   └── auth.store.ts   # Zustand auth state
│           ├── lib/
│           │   └── utils.ts        # cn() className helper
│           ├── router.tsx          # React Router configuration
│           └── main.tsx            # App entry point
│
├── packages/
│   └── shared/
│       └── src/
│           ├── schemas/            # Zod schemas (one file per feature)
│           ├── enums/              # TypeScript enums
│           └── index.ts            # Barrel export
│
├── infra/
│   ├── docker-compose.yml          # Production stack
│   ├── docker-compose.dev.yml      # Dev infrastructure (Mongo + Redis only)
│   ├── nginx/nginx.conf            # Reverse proxy config
│   └── mongo/init-mongo.js         # MongoDB initialisation (creates app user)
│
├── docs/                           # Documentation
├── install.sh                      # One-line Ubuntu installer
├── update.sh                       # Production update script
├── turbo.json                      # Turborepo pipeline config
└── pnpm-workspace.yaml             # pnpm workspace definition
```

---

## 4. Infrastructure

### Docker Compose (production)

Five services defined in `infra/docker-compose.yml`:

| Service | Image | Role |
|---|---|---|
| `mongo` | `mongo:7` | Primary database |
| `redis` | `redis:7-alpine` | Job queue backing store |
| `api` | Built from `apps/api/Dockerfile` | REST API on port 3001 (internal) |
| `web` | Built from `apps/web/Dockerfile` | Static React build served by Nginx |
| `nginx` | `nginx:alpine` | Reverse proxy — public ports 80/443 |

All services share an internal Docker network called `internal`. Nothing except Nginx exposes ports to the host.

### Nginx routing

```
GET /api/*        → proxied to api:3001
GET /*            → served as static files from web container
```

The web container is just an Nginx serving the built React app. There is no Node.js process in production for the frontend.

### MongoDB initialisation

`infra/mongo/init-mongo.js` runs on first container start. It creates a limited-privilege `itdesk_user` account with read/write access only to the `itdesk` database. The API connects as this user — not as root.

### Dev setup

For local development, only MongoDB and Redis run in Docker:

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

MongoDB maps to `localhost:27018` (not 27017, to avoid clashing with any local Mongo install).
The API and web run directly with `pnpm dev` and hot reload.

---

## 5. Environment variables

All environment variables are validated at startup by `apps/api/src/config/env.ts` using Zod. If a required variable is missing or invalid, the API refuses to start with a clear error message.

### Required

| Variable | Description |
|---|---|
| `MONGODB_URI` | Full MongoDB connection string including credentials |
| `JWT_PRIVATE_KEY` | RS256 private key (PEM format, newlines as `\n`) |
| `JWT_PUBLIC_KEY` | RS256 public key (PEM format, newlines as `\n`) |
| `VAULT_ENCRYPTION_KEY` | 64-character hex string (32 bytes) — used for AES-256-GCM |
| `MONGO_ROOT_PASSWORD` | MongoDB root password (used by Compose, not the API directly) |
| `MONGO_APP_PASSWORD` | MongoDB app user password (used by Compose to build the URI) |

### Optional

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | API listen port |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime |
| `LDAP_ENABLED` | `false` | Enable LDAP/AD authentication |
| `SMTP_ENABLED` | `false` | Enable email sending |
| `INTUNE_ENABLED` | `false` | Enable Intune device sync |
| `MERAKI_ENABLED` | `false` | Enable Meraki sync |

LDAP, SMTP, Intune, and Meraki settings can also be configured via the admin UI and are stored encrypted in MongoDB. The database values take precedence over environment variables, so the UI is the preferred way to configure integrations after initial setup.

---

## 6. The shared package

`packages/shared` is imported by both `apps/api` and `apps/web`. It contains:

### Schemas (`src/schemas/`)

One file per feature (e.g. `vault.schema.ts`, `checklist.schema.ts`). Each file typically exports:

- **Create schema** — validates input for creating a resource
- **Update schema** — usually `CreateSchema.partial()`
- **Response schema** — the shape returned to clients
- **Inferred TypeScript types** — derived from the schemas with `z.infer<>`

Example pattern:
```typescript
export const CreateCredentialSchema = z.object({ ... });
export const UpdateCredentialSchema = CreateCredentialSchema.partial();
export const CredentialResponseSchema = z.object({ ... });

export type CreateCredentialInput = z.infer<typeof CreateCredentialSchema>;
export type UpdateCredentialInput = z.infer<typeof UpdateCredentialSchema>;
export type CredentialResponse = z.infer<typeof CredentialResponseSchema>;
```

The API uses the Create/Update schemas for request validation. The web uses the types for TypeScript safety on API responses.

### Enums (`src/enums/`)

Shared enums like `UserRole`, `VaultAccessLevel`, `CredentialCategory`, `VaultAuditAction` etc. These are TypeScript const enums exported and used in both the API models and the web UI.

---

## 7. API architecture

### App factory pattern

`apps/api/src/app.ts` exports a `createApp()` function that builds and returns the Express app. The actual server start (DB connection, port binding, worker startup) lives in `server.ts`. This separation makes testing easier.

### Module pattern

Every feature lives in `apps/api/src/modules/<feature>/` with four files:

```
feature.model.ts      Mongoose schema + TypeScript interface
feature.service.ts    Business logic — all DB interaction lives here
feature.controller.ts Thin layer — parse request, call service, return response
feature.routes.ts     Express Router — maps HTTP verbs/paths to controller functions
```

**Model** defines the Mongoose schema and exports the model and the TypeScript interface for the document type.

**Service** is where all the real work happens. It imports the model, runs queries, applies business rules, and returns plain objects (never Mongoose documents) to callers. Services throw `AppError` for known error conditions.

**Controller** is intentionally thin. It parses the request (body, params, query), calls the appropriate service function, and sends the response. It should contain no business logic.

**Routes** wires HTTP methods and middleware to controller functions:
```typescript
router.get('/', requireAuth, requireTech, c.listCredentials);
router.post('/', requireAuth, requireAdmin, c.createCredential);
```

### Error handling

`AppError` is a custom Error subclass that carries an HTTP status code:

```typescript
throw new AppError(404, 'Credential not found');
throw new AppError(403, 'Access denied');
throw new AppError(400, 'Validation error: ...');
```

The global error handler in `error.middleware.ts` catches:
- `AppError` — sends `{ error: message }` with the specified status code
- `ZodError` — sends `{ error: 'Validation error', details: ... }` with 400
- Everything else — logs it and sends 500 (with stack trace in development)

Because `express-async-errors` is imported at the top of `app.ts`, async route handlers don't need try/catch — thrown errors are automatically forwarded to the error handler.

### Route registration

All routes are registered in `app.ts` under the `/api/v1` prefix:

```typescript
v1.use('/vault', vaultRoutes);
v1.use('/assets', assetRoutes);
// etc.
```

When adding a new feature, you must register its router here.

---

## 8. Authentication & authorisation

### JWT RS256

The app uses asymmetric RS256 JWT signing. The private key signs access tokens; the public key verifies them. This means in theory the public key could be distributed to other services to verify tokens without sharing the signing secret.

- **Access token** — short-lived (default 15 minutes), sent in the `Authorization: Bearer` header
- **Refresh token** — long-lived (default 7 days), stored as an HttpOnly cookie, used to get a new access token

The refresh token is hashed with SHA-256 before storage in MongoDB. Only the hash is stored — the plain token is never persisted.

### Token flow

1. User logs in → API issues access token (in response body) + refresh token (HttpOnly cookie)
2. Web stores access token in Zustand memory (not localStorage — lost on page refresh intentionally)
3. On every API request, the Axios interceptor in `api/client.ts` attaches the access token as `Authorization: Bearer`
4. If any request returns 401, the interceptor automatically calls `POST /auth/refresh` with the cookie, gets a new access token, and retries the original request
5. On page load, `ProtectedRoute` attempts a silent refresh to restore the session

### Middleware

Three middleware functions in `auth.middleware.ts`:

```typescript
requireAuth    // Verifies the Bearer token, attaches user to req
requireTech    // requireAuth + role must be IT_TECHNICIAN, IT_ADMIN, or SUPER_ADMIN
requireAdmin   // requireAuth + role must be IT_ADMIN or SUPER_ADMIN
```

### AuthenticatedRequest pattern

Express's `Request` type doesn't know about `req.user`. After `requireAuth` runs, the user is attached, but TypeScript doesn't know this. The pattern used throughout the codebase is:

```typescript
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

// In a controller:
const { id, role } = (req as AuthenticatedRequest).user;
```

Never access `req.user` directly on an uncast `Request` — TypeScript will error in strict mode.

### Roles

Four roles in ascending order of privilege:

| Role | Value | Access |
|---|---|---|
| End user | `end_user` | Can submit and view their own tickets |
| IT Technician | `it_technician` | Full read/write on most modules |
| IT Admin | `it_admin` | Everything + user management + destructive operations |
| Super Admin | `super_admin` | Same as IT Admin — reserved for the primary account |

The role hierarchy is checked numerically in `AppShell.tsx`:

```typescript
const roleWeight = { end_user: 0, it_technician: 1, it_admin: 2, super_admin: 3 };
```

### LDAP/AD authentication

When `LDAP_ENABLED` is true (or enabled via the admin UI), login attempts are routed through `ldapjs` to authenticate against the domain controller. On successful LDAP auth, the user's group memberships are checked against the configured group DNs to assign a role. The user record is upserted in MongoDB on each login — LDAP is the source of truth for credentials, but ITin1 stores the profile.

### Two-factor authentication

2FA is implemented with TOTP (Time-based One-Time Passwords, compatible with Google Authenticator, Authy etc.). Users can enroll from their profile. Recovery codes are generated at enrollment, hashed with SHA-256, and stored — they're single-use.

---

## 9. Encryption

### Vault passwords

The vault uses AES-256-GCM, implemented in `apps/api/src/lib/crypto.ts`.

Every credential's password is stored as three fields in MongoDB:
- `passwordIv` — 96-bit random initialisation vector (hex)
- `encryptedPassword` — the ciphertext (hex)
- `passwordAuthTag` — the GCM authentication tag (hex), which guarantees integrity

The key is derived from `VAULT_ENCRYPTION_KEY` — a 64-character hex string representing 32 bytes. **This key is the single most important secret in the system.** If it is lost, all vault passwords become unrecoverable. Back it up separately from the database.

```typescript
// Encrypting
const { iv, ciphertext, authTag } = encrypt(plaintext);

// Decrypting
const plaintext = decrypt(iv, ciphertext, authTag);
```

### Integration config secrets

SMTP passwords, LDAP bind credentials, Intune client secrets, and Meraki API keys are stored in the `IntegrationConfig` MongoDB document. Each sensitive field is individually AES-256-GCM encrypted using the same `VAULT_ENCRYPTION_KEY` and stored as a JSON string containing `{ iv, ciphertext, authTag }`.

The `integration-config.service.ts` handles the encrypt/decrypt transparently. When the UI reads config, secrets are masked (returned as `hasPassword: true` rather than the actual value). When the UI saves config, a non-empty value replaces the stored one; an empty value leaves the existing secret unchanged.

---

## 10. Feature modules

A brief description of what each module does and any non-obvious implementation details.

### `auth`
Login (local + LDAP), token refresh, logout, 2FA enrollment/verify, recovery codes, and the `seedDefaultAdmin()` function that creates the initial `admin/changeme123!` account on first startup if no users exist.

### `users`
User CRUD. Admins can create, update, and deactivate users. Deactivated users cannot log in. The user model stores `passwordHash` (bcryptjs, 12 rounds) with `select: false` so it's never returned in queries unless explicitly selected.

### `setup`
Two public endpoints (no auth required):
- `GET /setup/status` — returns `{ complete: boolean }` based on the `setupComplete` flag in `OrgSettings`
- `POST /setup/complete` — runs the first-run wizard: updates/creates the admin user, sets the org name, configures SMTP if provided, and sets `setupComplete: true`. Returns 409 if setup has already been completed.

### `admin` (settings, backup, integration config)
- **OrgSettings** — singleton MongoDB document (`_id: 'org_settings'`) storing org name, logo URL, and the `setupComplete` flag
- **IntegrationConfig** — singleton document (`_id: 'integration_config'`) storing all integration credentials encrypted
- **Backup** — exports the entire MongoDB database as a JSON dump; restore overwrites all collections

### `vault`
The credential vault. Key implementation details:
- `canAccess()` — checks access level before returning credentials. Staff = all techs, Admin = admins only, Restricted = specific named users only
- Passwords are never returned in list or get responses — only via explicit `POST /:id/reveal` or `POST /:id/copy`, both of which write an audit log entry
- Folders are a separate `VaultFolder` model. Deleting a folder unsets the `folder` field on its credentials (they become unfiled) rather than cascading deletes
- The audit log (`VaultAudit`) is append-only and records credential ID, a title snapshot (in case the credential is later deleted), user, action, and IP address

### `assets`
Full asset lifecycle. Assets have a large schema covering hardware specs, network info, location, assigned user, purchase/warranty dates. Key things:
- `externalSource` field tracks whether an asset came from Intune or Meraki — used to avoid duplicating external assets on re-sync
- QR code generation happens client-side using the `qrcode` library — no server involvement
- CSV import maps column names from a template format; the template can be downloaded from the import modal

### `tickets`
Standard helpdesk ticketing. Tickets have priority, category, status, assigned technician, and file attachments. Attachments are stored on disk in the `uploads/` directory (Docker volume in production) and served as static files by Express.

### `docs`
Knowledge base with a TipTap rich-text editor. Articles have a slug (URL-safe title), category, tags, and an optional `sourceUrl` for linking to external reference documents. Full-text search uses MongoDB's `$text` index on title and body.

### `network` (racks, networks, IPAM)
- **Racks** — server rack management with U-slot occupancy tracking. Each rack has a defined height in U; equipment occupies a start U and size
- **Networks** — subnet definitions with CIDR, gateway, DHCP range
- **IPAM** — IP address tracking within a subnet. The scan feature opens TCP connections to a configurable set of ports per host to determine if an address is in use

### `ssl-certs`
SSL certificate tracking. Certificates can be added manually or imported from a file. The `notAfter` field drives expiry calculations. The daily alert worker sends digest emails for certs expiring within configurable thresholds.

### `licenses`
Software licence management. Status (`active`, `expiring_soon`, `expired`, `inactive`) is derived at query time from `renewalDate` and a `daysWarning` threshold — it is never stored. The daily alert worker at 08:15 sends a digest categorised as Critical (≤14 days), Warning (≤30 days), or Notice (≤90 days).

### `contracts`
Contract and warranty tracking. `noticeDueDate` is computed as `endDate - noticePeriodDays` and returned in responses but not stored. The renewals endpoint (`GET /contracts/renewals`) returns contracts expiring within 90 days, used by the combined renewals dashboard. Alert worker runs at 08:30.

### `changelog`
Infrastructure diary. Entries have a category (hardware, software, network, security, other), body text, and optional rollback notes. Full-text search via MongoDB `$text` index. Any technician can create entries; only admins can delete.

### `checklists`
Two models: `ChecklistTemplate` and `ChecklistRun`.

When a run is created from a template, the template's items are **copied** into the run document as subdocuments. This means editing the template later doesn't affect in-progress runs — each run is a snapshot.

Items within a run are Mongoose subdocuments with auto-generated `_id`. The `toggleItem` service function looks up the item by its `_id.toString()`, flips `completed`, records `completedAt` and `completedBy` (display name looked up from the User model), and auto-completes the run if all required items are done.

### `vendors` / `contacts`
Simple CRUD with cross-linking to assets, credentials, and contracts.

### `secure-share`
One-time credential sharing. A secure share token is generated, stored with an expiry and a view limit (default: 1 use). The encrypted password is re-encrypted with a share-specific key and stored alongside the token. Recipients access `GET /secure/:token` without authentication. After the view limit is reached, the token is deleted.

### `search`
Global search endpoint (`GET /search?q=...`) that queries assets, tickets, docs articles, and credentials in parallel using `Promise.all` and returns merged results.

### `integrations`
Three integration modules:
- **Intune** — queries Microsoft Graph API to sync managed devices as assets. Uses OAuth2 client credentials flow with an Azure App Registration
- **Meraki** — queries the Meraki Dashboard API to sync network devices as assets
- **AD** — uses `ldapjs` to sync computer objects from Active Directory as assets

Each integration has a manual trigger endpoint and an optional cron schedule. Sync results upsert assets using `externalId` as the match key.

---

## 11. Background jobs

All background work uses BullMQ, defined in `apps/api/src/jobs/queues.ts`.

### Queue pattern

Each job type has:
1. A `Queue` instance — used to add jobs
2. A `Worker` instance — processes jobs from the queue
3. Helper functions — `addIntuneSync()`, etc.

BullMQ requires its own Redis connection config rather than sharing an existing ioredis instance (pnpm deduplication causes version mismatches). The connection is built from parsing `REDIS_URL`.

### Scheduled jobs

Daily alert workers use BullMQ's `repeat` option with cron expressions:

| Job | Schedule | What it does |
|---|---|---|
| Asset warranty alerts | `0 8 * * *` (08:00) | Emails digest of assets with warranties expiring soon |
| SSL cert alerts | `10 8 * * *` (08:10) | Emails digest of certs expiring within thresholds |
| License alerts | `15 8 * * *` (08:15) | Emails digest of licences expiring |
| Contract alerts | `30 8 * * *` (08:30) | Emails digest of contracts/warranties expiring |

### Integration sync workers

Intune, Meraki, and AD syncs can be triggered manually (via the admin UI) or on a schedule (configured per-integration). Manual triggers add a job with a timestamped `jobId` to avoid deduplication with scheduled jobs.

### `stopWorkers()`

Called on graceful shutdown (SIGTERM/SIGINT) to close all workers cleanly before the process exits.

---

## 12. Frontend architecture

### Routing

React Router v6 in `router.tsx`. Two key wrappers:

**`SetupGuard`** — wraps all normal routes. Fetches `GET /setup/status` once (cached indefinitely with `staleTime: Infinity`). If setup is not complete, redirects to `/setup`. Once complete, that query never runs again.

**`ProtectedRoute`** — wraps authenticated routes. On mount, attempts a silent token refresh using the HttpOnly cookie. If it succeeds, sets the access token and user in Zustand state. If it fails (cookie expired or absent), redirects to `/login`. While checking, shows a loading state.

### API client

`apps/web/src/api/client.ts` creates a single Axios instance with:
- `baseURL: '/api/v1'` — works in both development (Vite proxies to localhost:3001) and production (Nginx routes `/api/*` to the API container)
- `withCredentials: true` — ensures the HttpOnly refresh token cookie is sent
- **Request interceptor** — attaches the access token from Zustand to `Authorization: Bearer`
- **Response interceptor** — on 401, attempts token refresh, queues in-flight requests, retries them with the new token. If refresh fails, clears state and redirects to `/login`

### Data fetching

All server state is managed with TanStack Query (React Query v5). The pattern in every page component:

```typescript
// Reading data
const { data = [], isLoading } = useQuery({
  queryKey: ['vault'],
  queryFn: () => listCredentials(),
});

// Writing data
const { mutate, isPending } = useMutation({
  mutationFn: (input) => createCredential(input),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['vault'] });
  },
});
```

Query keys are arrays. Use consistent, hierarchical keys so invalidation is predictable:
- `['vault']` — all credentials
- `['vault', 'folders']` — folder list
- `['vault', 'folder', folderId]` — credentials in a specific folder

### Auth state

Zustand (`stores/auth.store.ts`) holds three values in memory:
- `accessToken` — the JWT, never written to localStorage
- `user` — the current user profile (`UserResponse` type from shared)
- `isAuthenticated` — boolean derived from whether a token is present

Because it's in memory, a page refresh clears it. `ProtectedRoute` handles re-hydration via the silent refresh on every page load.

### API function files

Each feature has a corresponding file in `apps/web/src/api/`. These are plain async functions that call the Axios client and return typed data. They do not use hooks — they're passed to `queryFn` and `mutationFn`.

---

## 13. UI conventions

### Component library

shadcn/ui components live in `apps/web/src/components/ui/`. **Do not edit these files** — they are generated components. If you need a customised version of a component, build a wrapper.

Available components include: `Button`, `Input`, `Label`, `Select`, `Dialog`, `Card`, `Textarea`, `Badge`, `Tooltip`, `Table`. Check this directory before building custom UI.

### Dropdown/popover backgrounds

Custom dropdown menus and popover-style elements **must** use:

```css
bg-white dark:bg-zinc-900
```

**Never use `bg-popover`** — this renders as transparent in the current Tailwind/shadcn setup and makes dropdowns invisible.

### Modal pattern

Modals are implemented using shadcn's `Dialog` component. The standard pattern:

```typescript
<Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
  <DialogContent>
    <DialogHeader><DialogTitle>...</DialogTitle></DialogHeader>
    {/* content */}
    <DialogFooter>
      <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
      <Button onClick={handleSave}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Forms

Most forms use `react-hook-form` with `zodResolver` to wire Zod schemas directly to form validation:

```typescript
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(CreateCredentialSchema),
});
```

For Select components (which are not native inputs), use `setValue` from `useForm` in the `onValueChange` callback:

```typescript
<Select onValueChange={(v) => setValue('category', v as CreateCredentialInput['category'])}>
```

### Tab navigation

The project does not have a shadcn `Tabs` component installed. Use the state-based pattern instead:

```typescript
const [activeTab, setActiveTab] = useState<'templates' | 'runs'>('runs');

<div className="flex gap-1 border-b mb-4">
  {(['runs', 'templates'] as const).map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        activeTab === tab ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
      }`}
    >
      {tab}
    </button>
  ))}
</div>
```

### Access control in the UI

Use `useAuthStore` to get the current user and check their role:

```typescript
const user = useAuthStore((s) => s.user);
const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;
```

Conditionally render admin-only UI elements with `{isAdmin && <Button>...</Button>}`. The API enforces access independently — UI gating is for UX only.

---

## 14. Adding a new feature end-to-end

This is the exact sequence to follow when building a new feature from scratch.

### Step 1 — Define the schema (shared package)

Create `packages/shared/src/schemas/widget.schema.ts`:

```typescript
import { z } from 'zod';

export const CreateWidgetSchema = z.object({
  name: z.string().min(1).max(200),
  colour: z.string().optional(),
});

export const UpdateWidgetSchema = CreateWidgetSchema.partial();

export const WidgetResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  colour: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateWidgetInput = z.infer<typeof CreateWidgetSchema>;
export type UpdateWidgetInput = z.infer<typeof UpdateWidgetSchema>;
export type WidgetResponse = z.infer<typeof WidgetResponseSchema>;
```

Export from `packages/shared/src/index.ts`:
```typescript
export * from './schemas/widget.schema.js';
```

### Step 2 — Build the API module

**`widget.model.ts`**
```typescript
import mongoose, { type Document, type Model } from 'mongoose';

export interface IWidget {
  name: string;
  colour?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWidgetDocument extends IWidget, Document {}

const widgetSchema = new mongoose.Schema<IWidgetDocument>(
  { name: { type: String, required: true }, colour: String },
  { timestamps: true },
);

export const Widget: Model<IWidgetDocument> = mongoose.model('Widget', widgetSchema);
```

**`widget.service.ts`**
```typescript
import { Widget, type IWidgetDocument } from './widget.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateWidgetInput, UpdateWidgetInput } from '@itdesk/shared';

function toResponse(doc: IWidgetDocument) {
  return {
    id: doc.id as string,
    name: doc.name,
    colour: doc.colour,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listWidgets() {
  const docs = await Widget.find().sort({ name: 1 });
  return docs.map(toResponse);
}

export async function createWidget(input: CreateWidgetInput) {
  const doc = await Widget.create(input);
  return toResponse(doc);
}

export async function updateWidget(id: string, input: UpdateWidgetInput) {
  const doc = await Widget.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true });
  if (!doc) throw new AppError(404, 'Widget not found');
  return toResponse(doc);
}

export async function deleteWidget(id: string) {
  const doc = await Widget.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, 'Widget not found');
}
```

**`widget.controller.ts`**
```typescript
import type { Request, Response } from 'express';
import * as service from './widget.service.js';
import { CreateWidgetSchema, UpdateWidgetSchema } from '@itdesk/shared';
import { AppError } from '../../middleware/error.middleware.js';

export async function listWidgets(_req: Request, res: Response) {
  res.json(await service.listWidgets());
}

export async function createWidget(req: Request, res: Response) {
  const parsed = CreateWidgetSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  res.status(201).json(await service.createWidget(parsed.data));
}

export async function updateWidget(req: Request, res: Response) {
  const parsed = UpdateWidgetSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  res.json(await service.updateWidget(String(req.params['id']), parsed.data));
}

export async function deleteWidget(req: Request, res: Response) {
  await service.deleteWidget(String(req.params['id']));
  res.status(204).end();
}
```

**`widget.routes.ts`**
```typescript
import { Router, type IRouter } from 'express';
import * as c from './widget.controller.js';
import { requireAuth, requireTech, requireAdmin } from '../../middleware/auth.middleware.js';

const router: IRouter = Router();

router.use(requireAuth, requireTech);
router.get('/', c.listWidgets);
router.post('/', requireAdmin, c.createWidget);
router.patch('/:id', requireAdmin, c.updateWidget);
router.delete('/:id', requireAdmin, c.deleteWidget);

export default router;
```

Register in `app.ts`:
```typescript
import widgetRoutes from './modules/widgets/widget.routes.js';
// ...
v1.use('/widgets', widgetRoutes);
```

### Step 3 — Build the web API client

`apps/web/src/api/widgets.ts`:
```typescript
import { apiClient } from './client';
import type { CreateWidgetInput, UpdateWidgetInput, WidgetResponse } from '@itdesk/shared';

export async function getWidgets(): Promise<WidgetResponse[]> {
  const { data } = await apiClient.get('/widgets');
  return data;
}

export async function createWidget(input: CreateWidgetInput): Promise<WidgetResponse> {
  const { data } = await apiClient.post('/widgets', input);
  return data;
}

export async function updateWidget(id: string, input: UpdateWidgetInput): Promise<WidgetResponse> {
  const { data } = await apiClient.patch(`/widgets/${id}`, input);
  return data;
}

export async function deleteWidget(id: string): Promise<void> {
  await apiClient.delete(`/widgets/${id}`);
}
```

### Step 4 — Build the page component

`apps/web/src/pages/widgets/WidgetsPage.tsx` — use the patterns from any existing page as a template.

### Step 5 — Wire up routing and navigation

In `router.tsx`:
```typescript
import { WidgetsPage } from '@/pages/widgets/WidgetsPage';
// ...
{ path: 'widgets', element: <WidgetsPage /> },
```

In `AppShell.tsx`:
```typescript
{ href: '/widgets', label: 'Widgets', icon: SomeIcon, minRole: 'it_technician' },
```

### Step 6 — Typecheck

```bash
pnpm typecheck
```

Fix all errors before committing. The CI will reject PRs with TypeScript errors.

---

## 15. Common patterns & gotchas

### Mongoose documents vs plain objects

Mongoose documents are not plain objects. When a controller returns a document directly, you lose `id` (the virtual), and serialisation can behave unexpectedly. Always map documents to plain objects in the service's `toResponse()` function before returning.

When a document has populated subdocuments, call `.toObject({ virtuals: true })` first:
```typescript
const obj = doc.toObject({ virtuals: true });
// Now obj.linkedAsset is a plain object with ._id, not a populated document
const assetId = obj.linkedAsset?._id?.toString() ?? obj.linkedAsset?.id;
```

### ObjectId vs string

MongoDB stores IDs as `ObjectId` objects. When comparing IDs in application code, always convert to strings:

```typescript
// Correct
doc.allowedUsers.some((id) => id.toString() === userId)

// Wrong — ObjectId !== string even if they look the same
doc.allowedUsers.some((id) => id === userId)
```

When passing IDs to Mongoose queries, wrap strings in `new mongoose.Types.ObjectId(id)`.

### Singleton models (OrgSettings, IntegrationConfig)

Both of these are single-document collections. They use a fixed `_id` string (`'org_settings'` and `'integration_config'`) and are always upserted, never created fresh:

```typescript
await OrgSettings.findByIdAndUpdate(
  'org_settings',
  { $set: { _id: 'org_settings', ...data } },
  { upsert: true, new: true },
);
```

The `_id: 'org_settings'` must be in the `$set` for upserts to work with a custom `_id`.

### TypeScript strict mode with `any`

The project uses TypeScript strict mode. `any` is allowed where genuinely necessary (e.g. Mongoose `lean()` results, populated document types) but should always have a comment explaining why. Avoid casting to `any` just to silence an error — fix the underlying type issue.

### The `select: false` pattern

`User.passwordHash` has `select: false` on the Mongoose schema. This means it is **never included** in query results unless explicitly selected:

```typescript
// passwordHash NOT included
const user = await User.findById(id);

// passwordHash included
const user = await User.findById(id).select('+passwordHash');
```

This prevents accidentally leaking password hashes in API responses.

### BullMQ Redis connection

Do not try to share an ioredis instance with BullMQ. pnpm's deduplication means BullMQ may be using a different version of ioredis internally, causing incompatibility errors. Always build BullMQ's connection config from the URL directly:

```typescript
const redisUrl = new URL(env.REDIS_URL);
const connection = { host: redisUrl.hostname, port: Number(redisUrl.port) || 6379 };
```

### Zod `.safeParse()` in controllers

Always use `safeParse()` rather than `parse()` in controllers. `parse()` throws a `ZodError` which the global handler catches, but `safeParse()` gives you control to return a meaningful error message:

```typescript
const parsed = CreateWidgetSchema.safeParse(req.body);
if (!parsed.success) throw new AppError(400, 'Validation error: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
```

### Invalidating related queries

When a mutation affects multiple query keys, invalidate all of them in `onSuccess`. For example, creating a credential in a folder should invalidate both the credentials list and the folder counts:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['vault'] });
  queryClient.invalidateQueries({ queryKey: ['vault', 'folders'] });
}
```

---

## 16. Operations & maintenance

### Viewing logs

```bash
# All services
docker compose -f infra/docker-compose.yml logs -f

# API only
docker compose -f infra/docker-compose.yml logs -f api

# Last 100 lines
docker compose -f infra/docker-compose.yml logs --tail=100 api
```

### Updating the application

```bash
bash /opt/itdesk/update.sh
```

Or manually:
```bash
cd /opt/itdesk
git pull
cd infra
docker compose build --no-cache
docker compose up -d
```

### Restarting a single service

```bash
cd /opt/itdesk/infra
docker compose restart api
```

### Opening a MongoDB shell

```bash
docker compose exec mongo mongosh -u root -p
use itdesk
db.credentials.countDocuments()
```

### Backup and restore

From the admin UI: **Admin → Backup** — exports a full JSON dump of all collections.

Command line restore (replaces all data):
```bash
# Copy backup file into the container and restore
docker compose exec -T api node -e "
  const data = require('/tmp/backup.json');
  // restore logic runs via the API's restore endpoint
"
```

In practice, use the UI restore button — it uploads the JSON and the API handles the collection-by-collection restore.

### Changing the vault encryption key

**This is a destructive operation.** If you rotate the `VAULT_ENCRYPTION_KEY`:
1. All stored vault passwords will become unreadable
2. All integration config secrets will become unreadable

To rotate the key safely you would need to: decrypt every secret with the old key, re-encrypt with the new key, update all records, then change the environment variable. There is no built-in tooling for this — it is a manual operation. The easiest safe approach is to export all credentials first, change the key, re-import.

### Adding HTTPS

The Nginx config ships as HTTP-only. To add HTTPS:

**Self-signed (internal/LAN use):**
```bash
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout infra/nginx/server.key \
  -out infra/nginx/server.crt \
  -subj "/CN=itdesk.yourdomain.local"
```
Then update `infra/nginx/nginx.conf` to add a port 443 server block and mount the cert files.

**Let's Encrypt (internet-facing):**
Use `infra/setup-ssl.sh` which handles Certbot configuration and Nginx reload.

### Health check endpoint

The API exposes `GET /api/v1/auth/health` — returns 200 with no auth required. Used by `install.sh` to wait for the API to be ready, and can be used for uptime monitoring.
