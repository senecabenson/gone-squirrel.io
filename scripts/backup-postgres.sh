#!/usr/bin/env bash
# Daily Postgres backup. Cron-able. Run from the repo root.
# usage: ./scripts/backup-postgres.sh
# cron example (daily 03:30):
#   30 3 * * * cd /opt/gonesquirrel && ./scripts/backup-postgres.sh >> /var/log/gonesquirrel-backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "missing .env.production" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; . ./.env.production; set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/gonesquirrel}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"

TS=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/postgres-$TS.sql.gz"

docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$OUT"

echo "wrote $OUT ($(du -h "$OUT" | awk '{print $1}'))"

find "$BACKUP_DIR" -name 'postgres-*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete
