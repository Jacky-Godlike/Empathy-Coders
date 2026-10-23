#!/usr/bin/env bash
# Replit Run button: install once, build the frontend if needed, then serve.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/smartorder-hub"

if ! python3 -c "import fastapi, uvicorn" >/dev/null 2>&1; then
  echo "==> Installing backend dependencies"
  python3 -m pip install --upgrade pip
  python3 -m pip install -r "$APP/backend/requirements.txt"
fi

if [ ! -d "$APP/frontend/node_modules" ]; then
  echo "==> Installing frontend dependencies"
  cd "$APP/frontend"
  npm install --no-audit --no-fund
fi

if [ ! -f "$APP/frontend/dist/index.html" ]; then
  echo "==> Building the React frontend"
  cd "$APP/frontend"
  npm run build
fi

cd "$APP/backend"
echo "==> Starting SmartOrder Hub on port ${PORT:-3000}"
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-3000}"
