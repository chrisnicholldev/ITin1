#!/bin/bash
# ITDesk update script
# Usage: bash update.sh
# Pulls latest code, rebuilds Docker images, and restarts services.

set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────────
COMPOSE_FILE="infra/docker-compose.yml"
HEALTH_URL="${ITDESK_URL:-}"       # Set ITDESK_URL in .env to enable health check
HEALTH_TIMEOUT=60                  # Seconds to wait for app to come back up
BRANCH="main"

# ── Helpers ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✗]${NC} $*"; exit 1; }
step()    { echo -e "\n${YELLOW}──${NC} $*"; }

START_TIME=$(date +%s)

# ── Pre-flight checks ──────────────────────────────────────────────────────────
step "Pre-flight checks"

if [ ! -f "$COMPOSE_FILE" ]; then
  error "Not in the ITDesk project root. Run this script from /opt/itdesk (or wherever you cloned the repo)."
fi

if ! command -v docker &>/dev/null; then
  error "Docker is not installed or not on PATH."
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  warn "You are on branch '$CURRENT_BRANCH', not '$BRANCH'."
  read -rp "    Continue anyway? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || error "Aborted."
fi

info "On branch $CURRENT_BRANCH"

# ── Pull latest code ───────────────────────────────────────────────────────────
step "Pulling latest code from remote"

BEFORE=$(git rev-parse HEAD)
git pull
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  warn "No new commits — already up to date."
  read -rp "    Rebuild and restart anyway? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { info "Nothing to do. Exiting."; exit 0; }
else
  COMMIT_COUNT=$(git rev-list --count "$BEFORE".."$AFTER")
  info "Pulled $COMMIT_COUNT new commit(s)"
  git log --oneline "$BEFORE".."$AFTER"
fi

# ── Rebuild images ─────────────────────────────────────────────────────────────
step "Building Docker images"

docker compose -f "$COMPOSE_FILE" build
info "Build complete"

# ── Restart services ───────────────────────────────────────────────────────────
step "Restarting services"

docker compose -f "$COMPOSE_FILE" up -d
info "Services restarted"

# ── Health check ───────────────────────────────────────────────────────────────
if [ -n "$HEALTH_URL" ]; then
  step "Waiting for app to respond at $HEALTH_URL"
  ELAPSED=0
  until curl -sf --max-time 5 "$HEALTH_URL" &>/dev/null; do
    if [ "$ELAPSED" -ge "$HEALTH_TIMEOUT" ]; then
      error "App did not respond within ${HEALTH_TIMEOUT}s. Check logs: docker compose -f $COMPOSE_FILE logs --tail=50"
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
    echo -n "."
  done
  echo ""
  info "App is responding"
else
  warn "No ITDESK_URL set — skipping health check. Add it to .env to enable."
fi

# ── Cleanup ────────────────────────────────────────────────────────────────────
step "Cleaning up old images"

docker image prune -f --filter "until=24h" &>/dev/null
info "Done"

# ── Summary ────────────────────────────────────────────────────────────────────
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${GREEN}Update complete in ${DURATION}s${NC}"
echo ""
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}"
