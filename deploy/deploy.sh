#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/roundtalk"

cd "$APP_DIR"
git pull origin main
docker compose --env-file .env up -d --build

echo "Deploy completed."
