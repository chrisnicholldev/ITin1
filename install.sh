#!/usr/bin/env bash
set -euo pipefail

# ── ITin1 Installer ──────────────────────────────────────────────────────────
# Usage (private repo):
#   curl -fsSL -H "Authorization: token YOUR_TOKEN" \
#     https://raw.githubusercontent.com/chrisnicholldev/ITin1/main/install.sh | bash
#
# Usage (once public):
#   curl -fsSL https://raw.githubusercontent.com/chrisnicholldev/ITin1/main/install.sh | bash
#
# Optional environment variables:
#   GITHUB_TOKEN   - Personal access token for private repo access
#   INSTALL_DIR    - Where to install (default: /opt/itdesk)
#   ITDESK_PORT    - HTTP port to bind (default: 80)

REPO="chrisnicholldev/ITin1"
INSTALL_DIR="${INSTALL_DIR:-/opt/itdesk}"
ITDESK_PORT="${ITDESK_PORT:-80}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

# ── Colours ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${BLUE}▶${RESET} $*"; }
success() { echo -e "${GREEN}✔${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET} $*"; }
error()   { echo -e "${RED}✖${RESET} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}$*${RESET}"; }

# ── Preflight ─────────────────────────────────────────────────────────────────

header "ITin1 Installer"

# Must run as root or with sudo
if [[ $EUID -ne 0 ]]; then
  error "Please run with sudo: sudo bash install.sh"
fi

# Ubuntu only (other distros may work but are untested)
if ! command -v apt-get &>/dev/null; then
  error "This installer requires an apt-based Linux distribution (Ubuntu 22.04+ recommended)."
fi

# Check required tools
for cmd in curl openssl awk git; do
  if ! command -v "$cmd" &>/dev/null; then
    info "Installing missing dependency: $cmd"
    apt-get install -y -qq "$cmd"
  fi
done

# ── Docker ────────────────────────────────────────────────────────────────────

header "Checking Docker"

install_docker() {
  info "Installing Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker --now
  success "Docker installed."
}

if ! command -v docker &>/dev/null; then
  install_docker
else
  success "Docker already installed ($(docker --version | awk '{print $3}' | tr -d ','))"
fi

if ! docker compose version &>/dev/null; then
  info "Installing Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
fi
success "Docker Compose available."

# ── Clone / update repo ───────────────────────────────────────────────────────

header "Fetching ITin1"

CLONE_URL="https://github.com/${REPO}.git"
if [[ -n "$GITHUB_TOKEN" ]]; then
  CLONE_URL="https://${GITHUB_TOKEN}@github.com/${REPO}.git"
fi

if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Updating existing installation at $INSTALL_DIR..."
  cd "$INSTALL_DIR"
  # Preserve .env if it exists
  if [[ -f "infra/.env" ]]; then
    cp infra/.env /tmp/itdesk_env_backup
  fi
  git pull --ff-only
  if [[ -f /tmp/itdesk_env_backup ]]; then
    cp /tmp/itdesk_env_backup infra/.env
    rm /tmp/itdesk_env_backup
  fi
  success "Updated to latest."
else
  info "Cloning to $INSTALL_DIR..."
  git clone "$CLONE_URL" "$INSTALL_DIR" --quiet
  success "Cloned."
fi

cd "$INSTALL_DIR"

# ── Generate secrets ──────────────────────────────────────────────────────────

header "Generating secrets"

ENV_FILE="$INSTALL_DIR/infra/.env"

if [[ -f "$ENV_FILE" ]]; then
  warn ".env already exists — skipping secret generation. Delete $ENV_FILE to regenerate."
else
  info "Generating JWT RS256 key pair..."
  TMP_PRIVATE=$(mktemp)
  TMP_PUBLIC=$(mktemp)
  openssl genpkey -algorithm RSA -out "$TMP_PRIVATE" -pkeyopt rsa_keygen_bits:2048 2>/dev/null
  openssl rsa -pubout -in "$TMP_PRIVATE" -out "$TMP_PUBLIC" 2>/dev/null

  # Format keys as single-line with literal \n for .env
  JWT_PRIVATE_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' "$TMP_PRIVATE")
  JWT_PUBLIC_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' "$TMP_PUBLIC")
  rm -f "$TMP_PRIVATE" "$TMP_PUBLIC"
  success "JWT keys generated."

  info "Generating database passwords and encryption key..."
  MONGO_ROOT_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
  MONGO_APP_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
  VAULT_ENCRYPTION_KEY=$(openssl rand -hex 32)
  success "Secrets generated."

  # Determine server IP (best guess — user can edit later)
  SERVER_IP=$(hostname -I | awk '{print $1}')

  info "Writing $ENV_FILE..."
  cat > "$ENV_FILE" <<ENVFILE
# ITin1 — generated by install.sh on $(date -u +"%Y-%m-%d %H:%M UTC")
# Edit this file to configure optional features (LDAP, SMTP, Intune, Meraki).

# Server
SERVER_IP=${SERVER_IP}
HTTP_PORT=${ITDESK_PORT}
CLIENT_URL=http://${SERVER_IP}

# MongoDB
MONGO_ROOT_USER=root
MONGO_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}
MONGO_APP_PASSWORD=${MONGO_APP_PASSWORD}

# JWT (RS256)
JWT_PRIVATE_KEY="${JWT_PRIVATE_KEY}"
JWT_PUBLIC_KEY="${JWT_PUBLIC_KEY}"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Vault encryption — back this up. Losing it means losing access to all stored passwords.
VAULT_ENCRYPTION_KEY=${VAULT_ENCRYPTION_KEY}

# LDAP / Active Directory (optional)
LDAP_ENABLED=false
LDAP_URL=ldap://dc.domain.local
LDAP_BIND_DN=CN=svc-itdesk,OU=Service Accounts,DC=domain,DC=local
LDAP_BIND_CREDENTIALS=
LDAP_SEARCH_BASE=DC=domain,DC=local
LDAP_SEARCH_FILTER=(sAMAccountName={{username}})
LDAP_ADMIN_GROUP=
LDAP_TECH_GROUP=
LDAP_USER_GROUP=

# Email / SMTP (optional — required for renewal alert digests)
SMTP_ENABLED=false
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=ITin1 <itdesk@domain.local>

# Microsoft Intune (optional)
INTUNE_ENABLED=false
INTUNE_TENANT_ID=
INTUNE_CLIENT_ID=
INTUNE_CLIENT_SECRET=
INTUNE_SYNC_SCHEDULE=

# Cisco Meraki (optional)
MERAKI_ENABLED=false
MERAKI_API_KEY=
MERAKI_ORG_ID=
MERAKI_SYNC_SCHEDULE=

# File uploads
MAX_FILE_SIZE_MB=25
ENVFILE

  success ".env written."
fi

# ── Start the stack ───────────────────────────────────────────────────────────

header "Starting ITin1"

cd "$INSTALL_DIR/infra"
info "Building and starting containers (this may take a few minutes on first run)..."
docker compose up -d --build --quiet-pull

# Wait for API to become ready (up to 60s)
info "Waiting for API to be ready..."
ATTEMPTS=0
until curl -sf http://localhost:${ITDESK_PORT}/api/v1/auth/health &>/dev/null || [[ $ATTEMPTS -ge 30 ]]; do
  sleep 2
  ATTEMPTS=$((ATTEMPTS + 1))
done

if [[ $ATTEMPTS -ge 30 ]]; then
  warn "API did not respond within 60 seconds. Check logs: docker compose -f $INSTALL_DIR/infra/docker-compose.yml logs api"
else
  success "API is ready."
fi

# ── Summary ───────────────────────────────────────────────────────────────────

SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}${BOLD}  ITin1 installed successfully!${RESET}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${BOLD}URL:${RESET}       http://${SERVER_IP}"
echo -e "  ${BOLD}Username:${RESET}  admin"
echo -e "  ${BOLD}Password:${RESET}  changeme123!"
echo ""
echo -e "  ${YELLOW}${BOLD}Change the default password immediately after login.${RESET}"
echo ""
echo -e "  ${BOLD}Config:${RESET}    $ENV_FILE"
echo -e "  ${BOLD}Logs:${RESET}      docker compose -f $INSTALL_DIR/infra/docker-compose.yml logs -f"
echo -e "  ${BOLD}Update:${RESET}    bash $INSTALL_DIR/update.sh"
echo ""
