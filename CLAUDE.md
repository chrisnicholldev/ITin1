# ITin1 — Dev Notes

## Fresh clone setup

```bash
./scripts/dev-setup.sh   # copies .env.example → apps/api/.env, runs pnpm install
```

## Running the app (always three terminals)

```bash
# Terminal 1
cd infra && docker compose -f docker-compose.dev.yml up -d

# Terminal 2
cd apps/api && pnpm dev

# Terminal 3
cd apps/web && pnpm dev
```

Never run `pnpm dev` from the repo root — Turborepo ordering causes issues.

## Secrets

On first run the API auto-generates RSA JWT keys and a vault encryption key, saving them to `apps/api/data/secrets.json` (gitignored). No manual key generation needed.

If you need to wipe and start fresh: delete `apps/api/data/` and drop the MongoDB database.

## Ports

| Service | Port |
|---------|------|
| Web     | 5173 |
| API     | 3001 |
| MongoDB | 27018 (mapped from 27017 inside container) |
| Redis   | 6379 |

## Branches

- `main` — production-ready
- `entra` — Microsoft Entra ID (Azure AD) login integration (in progress)
