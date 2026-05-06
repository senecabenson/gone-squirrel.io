# GoneSquirrel — Hostinger VPS deploy

One-time setup + deploy runbook for `gonesquirrel.nilegrowthworks.com`. Stack:
Next.js 15 standalone + Postgres 16, fronted by the **existing** Traefik
reverse proxy already running on the VPS (`root-traefik-1`). Traefik
handles TLS via the `mytlschallenge` resolver, same as the other apps on
this host (n8n, etc).

## Prerequisites

- VPS provisioned, Ubuntu 22.04 / 24.04 LTS.
- DNS A record `gonesquirrel.nilegrowthworks.com → 31.97.145.236` set at Porkbun.
  Verify with `dig +short A gonesquirrel.nilegrowthworks.com` before starting Caddy.
- SSH access as root (or a sudo user) to `31.97.145.236`.
- Google OAuth client credentials ready (or willing to update redirect URI
  to `https://gonesquirrel.nilegrowthworks.com/api/calendar/google` after deploy).

## One-time VPS setup

```bash
# SSH in
ssh root@31.97.145.236

# Update + install Docker (official repo, includes compose v2 plugin)
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg git ufw
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Firewall: only allow SSH + HTTP + HTTPS in
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Clone repo
mkdir -p /opt && cd /opt
git clone https://github.com/senecabenson/gone-squirrel.io.git gonesquirrel
cd gonesquirrel

# Create .env.production with real secrets
cp .env.production.example .env.production
# Generate NEXTAUTH_SECRET:
echo "NEXTAUTH_SECRET=$(openssl rand -base64 48)"
# Edit .env.production: set POSTGRES_PASSWORD (matching DATABASE_URL), NEXTAUTH_SECRET,
# and any optional Resend keys. Keep DATABASE_URL pointed at host "db".
nano .env.production
```

## First deploy

```bash
cd /opt/gonesquirrel
chmod +x scripts/deploy.sh scripts/backup-postgres.sh

./scripts/deploy.sh
```

Traefik (already running) will discover the new container via docker
labels and provision a Let's Encrypt cert on first request (10–30s). If
the health check fails, watch traefik:

```bash
docker logs -f root-traefik-1 | grep gonesquirrel
```

## Google OAuth update

After deploy succeeds, update the Google Cloud Console OAuth client:

- Authorized redirect URI: `https://gonesquirrel.nilegrowthworks.com/api/calendar/google`
  (add it; keep the localhost one for dev).
- Authorized JavaScript origin: `https://gonesquirrel.nilegrowthworks.com`.

Then in the app at `/settings#integrations`, populate the SystemSettings row
with the OAuth client_id / client_secret if not already done. Reconnect Google
Calendar from the UI.

## Daily backups

Cron the backup script as root:

```bash
crontab -e
# add:
30 3 * * * cd /opt/gonesquirrel && ./scripts/backup-postgres.sh >> /var/log/gonesquirrel-backup.log 2>&1
```

Backups land in `/var/backups/gonesquirrel/`, gzipped, kept 14 days. Override
`BACKUP_DIR` and `RETENTION_DAYS` in the env if you want different defaults.

For offsite backups, point `BACKUP_DIR` at a mount synced to a remote
(rclone, rsync, S3-compatible). Out of scope for the v1 deploy.

## Update flow

```bash
ssh root@31.97.145.236
cd /opt/gonesquirrel
./scripts/deploy.sh
```

`deploy.sh` does `git pull --ff-only`, rebuilds the image, restarts the
stack, and curls the domain to verify it answers.

## Rollback

```bash
cd /opt/gonesquirrel
git log --oneline -10               # find prior good commit
git checkout <sha>
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

If the database schema moved forward in a way that's incompatible with the
older code, restore from backup first:

```bash
gunzip < /var/backups/gonesquirrel/postgres-<TS>.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U $POSTGRES_USER -d $POSTGRES_DB
```

## Troubleshooting

| Symptom | First thing to check |
|---------|----------------------|
| `502 Bad Gateway` | `docker compose logs app` — likely a build or migrate failure. |
| Cert never issued | `docker logs root-traefik-1 \| grep gonesquirrel` — DNS not resolving, port 80 blocked at firewall, or Let's Encrypt rate-limited (try again in 1h). |
| `prisma migrate deploy` errors at startup | Inspect `entrypoint.sh` output in `docker compose logs app`. Manually run `docker compose exec app npx prisma migrate status`. |
| OAuth redirect_uri_mismatch | The Google Console redirect URI doesn't match `https://gonesquirrel.nilegrowthworks.com/api/calendar/google`. |

## Files this deploy uses

- [docker-compose.prod.yml](../docker-compose.prod.yml) — production stack (joins existing `root_default` network so Traefik can route)
- [.env.production.example](../.env.production.example) — env template
- [scripts/deploy.sh](../scripts/deploy.sh) — manual SSH deploy
- [scripts/backup-postgres.sh](../scripts/backup-postgres.sh) — daily pg_dump
