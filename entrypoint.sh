#!/bin/sh

# Extract database connection details from DATABASE_URL
PG_HOST=$(echo "$DATABASE_URL" | sed -E 's#.*@([^:/]+).*#\1#')
PG_PORT=$(echo "$DATABASE_URL" | sed -E 's/.*:([0-9]*)\/.*/\1/')
PG_PORT=${PG_PORT:-5432}

# Wait for database to be ready
echo "Waiting for database to be ready..."
while ! nc -z $PG_HOST $PG_PORT; do
  sleep 1
done
echo "Database is ready!"

# Run database migrations.
# Production image only ships node_modules/.prisma (the generated client),
# not the prisma CLI. `npx --yes prisma` would grab the latest (currently
# 7.x) which rejects our v6 schema.prisma. Pin the version to match
# package.json so future Prisma majors don't silently break boot.
echo "Running database migrations..."
npx --yes prisma@6.3.1 migrate deploy

# Start the application
echo "Starting the application..."
exec "$@" 