#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== ITin1 dev setup ==="

# 1. .env
ENV_SRC="$ROOT/apps/api/.env.example"
ENV_DST="$ROOT/apps/api/.env"

if [ -f "$ENV_DST" ]; then
  echo "[env] apps/api/.env already exists — skipping"
else
  cp "$ENV_SRC" "$ENV_DST"
  echo "[env] Created apps/api/.env from .env.example"
fi

# 2. pnpm install
echo "[deps] Installing dependencies..."
cd "$ROOT"
pnpm install

# 3. build shared package
echo "[build] Building @itdesk/shared..."
pnpm --filter @itdesk/shared build

echo ""
echo "=== Setup complete ==="
echo ""
echo "Start the app with three terminals:"
echo ""
echo "  Terminal 1 (infrastructure):"
echo "    cd infra && docker compose -f docker-compose.dev.yml up -d"
echo ""
echo "  Terminal 2 (API):"
echo "    cd apps/api && pnpm dev"
echo ""
echo "  Terminal 3 (Web):"
echo "    cd apps/web && pnpm dev"
echo ""
echo "Then open http://localhost:5173 and complete the setup wizard."
