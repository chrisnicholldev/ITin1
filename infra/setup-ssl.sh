#!/bin/bash
# Usage: ./infra/setup-ssl.sh <domain> <email>
# Example: ./infra/setup-ssl.sh itdesk.example.com admin@example.com
#
# Run this once after deploying to enable HTTPS.
# Safe to re-run if you need to renew or reconfigure.

set -e

DOMAIN="$1"
EMAIL="$2"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: $0 <domain> <email>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

echo "==> Creating webroot directory..."
sudo mkdir -p /var/www/certbot

echo "==> Ensuring nginx is running (HTTP mode)..."
docker compose -f "$COMPOSE_FILE" up -d nginx

# Give nginx a moment to come up
sleep 2

echo "==> Obtaining Let's Encrypt certificate for $DOMAIN..."
sudo certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive

echo "==> Installing SSL nginx config..."
sed "s/{{DOMAIN}}/$DOMAIN/g" "$SCRIPT_DIR/nginx/nginx-ssl.conf.template" \
  > "$SCRIPT_DIR/nginx/nginx.conf"

echo "==> Reloading nginx..."
docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload

echo ""
echo "==> Setting up auto-renewal hook..."
HOOK_DIR="/etc/letsencrypt/renewal-hooks/deploy"
sudo mkdir -p "$HOOK_DIR"
sudo tee "$HOOK_DIR/reload-nginx.sh" > /dev/null << EOF
#!/bin/bash
docker compose -f $COMPOSE_FILE exec -T nginx nginx -s reload
EOF
sudo chmod +x "$HOOK_DIR/reload-nginx.sh"

echo ""
echo "Done! HTTPS is now enabled for $DOMAIN."
echo ""
echo "Next steps:"
echo "  1. Update CLIENT_URL=https://$DOMAIN in your .env"
echo "  2. Set COOKIE_SECURE=true in your .env"
echo "  3. Run: docker compose -f $COMPOSE_FILE up -d api"
echo "  4. Once confirmed working, uncomment HSTS in nginx/nginx.conf"
echo ""
echo "Test renewal: sudo certbot renew --dry-run"
