#!/usr/bin/env bash
# Build SmartOrder Hub for Replit (development preview or published deployment).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/smartorder-hub"

echo "==> Installing backend dependencies"
python3 -m pip install --upgrade pip
python3 -m pip install -r "$APP/backend/requirements.txt"

echo "==> Installing frontend dependencies"
cd "$APP/frontend"
npm install --no-audit --no-fund

echo "==> Building the React frontend"
npm run build

echo "==> Build complete: $APP/frontend/dist"
