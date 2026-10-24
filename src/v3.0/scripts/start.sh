#!/usr/bin/env bash
# Replit published deployment: dependencies and frontend are built already.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/smartorder-hub"

if [ ! -f "$APP/frontend/dist/index.html" ]; then
  echo "Frontend build is missing. Run 'bash scripts/build.sh' before starting." >&2
  exit 1
fi

cd "$APP/backend"
echo "==> Starting SmartOrder Hub on port ${PORT:-3000}"
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-3000}"
