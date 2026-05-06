#!/usr/bin/env bash
# Production deploy on the Hostinger VPS. Run from the repo root after SSH'ing in.
# usage: ./scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "missing .env.production — copy .env.production.example and fill in secrets" >&2
  exit 1
fi

# Symlink so plain `docker compose ...` commands (ps, down, logs) pick up
# variable interpolation without needing --env-file every time.
ln -sf .env.production .env

echo "==> git pull"
git pull --ff-only

echo "==> docker compose build + up"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> wait 15s for app warmup"
sleep 15

echo "==> docker compose ps"
docker compose -f docker-compose.prod.yml ps

DOMAIN="$(grep -E '^NEXT_PUBLIC_APP_URL=' .env.production | sed -E 's,^.*=https?://,,; s,/.*,,')"
if [ -n "$DOMAIN" ]; then
  echo "==> health check https://$DOMAIN"
  curl -fsS -o /dev/null "https://$DOMAIN" && echo "app responding ✓" || echo "app not responding (Caddy may still be obtaining cert; check 'docker compose logs caddy')"
fi
