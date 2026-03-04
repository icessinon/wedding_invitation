#!/bin/sh
set -e

# ボリュームマウント後は node_modules が空のため、初回のみ npm ci で投入
if [ ! -d node_modules/next ]; then
    echo "Installing dependencies (npm ci)..."
    npm ci --legacy-peer-deps
fi

npx prisma generate

# app 起動時のみマイグレーション実行
if [ -n "$DATABASE_URL" ] && [ "$1" = "npm" ] && [ "$2" = "run" ] && [ "$3" = "dev" ]; then
    echo "Running database migrations..."
    npx prisma migrate deploy
fi

exec "$@"
