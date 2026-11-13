#!/usr/bin/env bash
# Start PlantGuard AI (backend + frontend) with one command: ./start.sh
# Installs dependencies on first run. Ctrl+C stops both servers.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Backend setup
if [ ! -x "$ROOT/backend/.venv/bin/uvicorn" ]; then
  echo "==> Setting up backend (first run)..."
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements.txt"
fi

# Frontend setup
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "==> Installing frontend dependencies (first run)..."
  (cd "$ROOT/frontend" && npm install)
fi

trap 'trap - EXIT INT TERM; kill 0 2>/dev/null; wait' EXIT INT TERM

echo "==> Backend:  http://localhost:8000/docs"
(cd "$ROOT/backend" && .venv/bin/uvicorn app.main:app --reload --port 8000) &

echo "==> Frontend: http://localhost:3000"
(cd "$ROOT/frontend" && npm run dev) &

wait
