# Contributing to ITDesk

Thanks for your interest in contributing. This document covers how to get a local development environment running and how to submit changes.

---

## Table of contents

- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Local development setup](#local-development-setup)
- [Project structure](#project-structure)
- [Running the app](#running-the-app)
- [Making changes](#making-changes)
- [Submitting a pull request](#submitting-a-pull-request)
- [Code style](#code-style)

---

## Tech stack

| Layer | Technology |
|---|---|
| API | Node.js 20+, Express, TypeScript (strict) |
| Web | React 18, TypeScript (strict), Tailwind CSS, shadcn/ui |
| Database | MongoDB 7 (Mongoose) |
| Queue | Redis 7, BullMQ |
| Monorepo | pnpm workspaces, Turborepo |
| Auth | JWT RS256, optional LDAP/AD via `ldapjs` |
| Encryption | AES-256-GCM (Node.js `crypto`) |

---

## Prerequisites

- **Node.js** 20 or later
- **pnpm** 10 or later (`npm install -g pnpm`)
- **Docker** and the **Docker Compose plugin** (for running MongoDB and Redis locally)
- **OpenSSL** (for generating JWT keys)
- **Git**

---

## Local development setup

### 1. Clone the repo

```bash
git clone https://github.com/chrisnicholldev/ITInternal.git
cd ITInternal
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start MongoDB and Redis

The dev compose file runs only the infrastructure services — MongoDB and Redis. The API and web run locally with hot reload.

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

This starts:
- MongoDB on `localhost:27018` (username: `root`, password: `devpassword`)
- Redis on `localhost:6379`

### 4. Configure the API environment

```bash
cp apps/api/.env.example apps/api/.env
```

The `.env.example` is pre-configured for the dev compose setup. The only thing you need to add is a JWT key pair.

**Generate JWT keys:**

```bash
openssl genpkey -algorithm RSA -out /tmp/dev_private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in /tmp/dev_private.pem -out /tmp/dev_public.pem

# Format as single-line with \n for the .env file
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' /tmp/dev_private.pem
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' /tmp/dev_public.pem
```

Paste the output into `apps/api/.env` as the `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` values (wrapped in double quotes).

**Generate a vault encryption key:**

```bash
openssl rand -hex 32
```

Paste the result as `VAULT_ENCRYPTION_KEY` in `apps/api/.env`.

### 5. Start the development servers

```bash
pnpm dev
```

This runs the API and web app in parallel with hot reload via Turborepo.

| Service | URL |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:3001 |

On first run, the setup wizard will appear at http://localhost:5173/setup. Complete it to create your admin account.

---

## Project structure

```
ITInternal/
├── apps/
│   ├── api/                  # Express API
│   │   └── src/
│   │       ├── modules/      # Feature modules (auth, assets, vault, etc.)
│   │       ├── middleware/   # Auth, error handling
│   │       ├── lib/          # Crypto, email helpers
│   │       ├── jobs/         # BullMQ queues and workers
│   │       └── config/       # Environment validation
│   └── web/                  # React frontend
│       └── src/
│           ├── api/          # API client functions
│           ├── components/   # Shared UI components
│           ├── pages/        # Page components (one per route)
│           ├── stores/       # Zustand state (auth)
│           └── router.tsx    # React Router config
├── packages/
│   └── shared/               # Types, Zod schemas, enums shared between API and web
└── infra/
    ├── docker-compose.yml    # Production compose
    ├── docker-compose.dev.yml # Dev infrastructure only
    ├── nginx/                # Nginx config
    └── mongo/                # MongoDB init script
```

### Module pattern (API)

Each feature lives in `apps/api/src/modules/<feature>/` and follows this structure:

```
feature/
├── feature.model.ts     # Mongoose schema and types
├── feature.service.ts   # Business logic
├── feature.controller.ts # Request/response handling
└── feature.routes.ts    # Express router
```

### Shared package

`packages/shared` contains Zod schemas and TypeScript types that are imported by both the API and web. When adding a new feature, define its input/response types here first.

---

## Running the app

```bash
# Start everything (API + web, hot reload)
pnpm dev

# Type check all packages
pnpm typecheck

# Build all packages
pnpm build

# Start dev infrastructure only (MongoDB + Redis)
docker compose -f infra/docker-compose.dev.yml up -d

# Stop dev infrastructure
docker compose -f infra/docker-compose.dev.yml down
```

---

## Making changes

### Adding a new feature

1. Define Zod schemas and types in `packages/shared/src/schemas/`
2. Export them from `packages/shared/src/index.ts`
3. Create the Mongoose model in `apps/api/src/modules/<feature>/`
4. Build service → controller → routes
5. Register routes in `apps/api/src/app.ts`
6. Add API client functions in `apps/web/src/api/`
7. Build the page component in `apps/web/src/pages/`
8. Add the route in `apps/web/src/router.tsx`
9. Add the nav item in `apps/web/src/components/layout/AppShell.tsx` if needed

### Branch naming

```
feature/short-description
fix/short-description
docs/short-description
```

---

## Submitting a pull request

1. Fork the repo and create a branch from `main`
2. Make your changes, keeping commits focused and messages clear
3. Run `pnpm typecheck` — PRs with TypeScript errors will not be merged
4. Open a pull request against `main` with a clear description of what changed and why
5. If your PR fixes an issue, reference it: `Fixes #123`

**Please do not:**
- Commit `.env` files or any secrets
- Add dependencies without discussion for large additions
- Mix unrelated changes in a single PR

---

## Code style

- TypeScript strict mode is enabled — no `any` casts without a comment explaining why
- No trailing `console.log` in production code paths
- shadcn/ui components where possible for the web — check `apps/web/src/components/ui/` before building custom UI
- Custom dropdowns must use `bg-white dark:bg-zinc-900` for the popover background (not `bg-popover`)
- No AI attribution in commit messages
