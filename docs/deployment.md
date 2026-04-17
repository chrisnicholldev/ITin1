# Deployment Guide — Ubuntu Server

ITin1 runs as a Docker Compose stack. This guide covers a fresh Ubuntu Server install.

---

## Requirements

- Ubuntu 22.04 LTS or 24.04 LTS
- 2 vCPU, 4 GB RAM minimum (8 GB recommended for Intune sync with large device counts)
- 20 GB disk (MongoDB + uploads)
- Network access to:
  - `login.microsoftonline.com` and `graph.microsoft.com` (if using Intune)
  - Your LDAP/AD server (if using LDAP auth)

---

## Step 1 — Install Docker

```bash
# Remove any old Docker packages
sudo apt remove docker docker-engine docker.io containerd runc

# Install prerequisites
sudo apt update && sudo apt install -y ca-certificates curl gnupg

# Add Docker's GPG key and repo
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list

sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Allow running Docker without sudo (log out and back in after this)
sudo usermod -aG docker $USER
```

---

## Step 2 — Clone the repo

```bash
git clone <your-repo-url> /opt/itdesk
cd /opt/itdesk
```

---

## Step 3 — Generate secrets

**JWT RS256 key pair:**
```bash
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in private.pem -out public.pem
```

The keys need to be single-line with `\n` for newlines in `.env`. Use this to format them:
```bash
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' private.pem
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' public.pem
```

**Vault encryption key:**
```bash
openssl rand -hex 32
```

**MongoDB passwords:** choose strong random strings (e.g. `openssl rand -base64 24`).

---

## Step 4 — Configure .env

```bash
cp infra/.env.example infra/.env
nano infra/.env   # or use your editor of choice
```

Fill in all required values. Required fields:

| Variable | Notes |
|---|---|
| `SERVER_IP` | LAN IP of the server (e.g. `192.168.1.50`) |
| `MONGO_ROOT_PASSWORD` | Strong password |
| `MONGO_APP_PASSWORD` | Strong password (different from root) |
| `JWT_PRIVATE_KEY` | RS256 private key (formatted with `\n`) |
| `JWT_PUBLIC_KEY` | RS256 public key (formatted with `\n`) |
| `VAULT_ENCRYPTION_KEY` | 64-char hex string from `openssl rand -hex 32` |

---

## Step 5 — Start the stack

```bash
cd /opt/itdesk/infra
docker compose up -d
```

Check all containers are healthy:
```bash
docker compose ps
docker compose logs api --tail=50
```

The app will be available at `http://<SERVER_IP>`.

Default super admin credentials (change immediately after first login):
- Username: `admin`
- Password: `changeme123!`

---

## Step 6 — Keep it running after reboot

Docker Compose services already have `restart: unless-stopped`. To ensure Docker itself starts on boot:

```bash
sudo systemctl enable docker
```

---

## Updating

```bash
cd /opt/itdesk
git pull
cd infra
docker compose build --no-cache
docker compose up -d
```

---

## Useful commands

```bash
# View logs
docker compose logs -f api
docker compose logs -f web

# Stop everything
docker compose down

# Stop and wipe all data (destructive!)
docker compose down -v

# Restart just the API (e.g. after .env change)
docker compose up -d --no-deps api

# Open a MongoDB shell
docker compose exec mongo mongosh -u root -p
```

---

## Firewall

If `ufw` is active, open the HTTP port:

```bash
sudo ufw allow 80/tcp
# If you add HTTPS later:
sudo ufw allow 443/tcp
```

---

## HTTPS (optional but recommended)

The current Nginx config is HTTP only. For HTTPS on an internal server, the easiest approach is a self-signed cert:

```bash
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout infra/nginx/server.key \
  -out infra/nginx/server.crt \
  -subj "/CN=itdesk.domain.local"
```

Then update `infra/nginx/nginx.conf` to add an HTTPS server block and mount the cert files. If the server is internet-facing, use Let's Encrypt with Certbot instead.
