#!/usr/bin/env bash
# Start both backend and dashboard in development mode.
# Usage: ./scripts/start-dev.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Starting ULTRON Backend ==="
cd "$ROOT/ultron-backend"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "=== Starting ULTRON Dashboard ==="
cd "$ROOT"
npm install --silent
npm run dev:web &
FRONTEND_PID=$!

echo ""
echo "  Backend  → http://localhost:8000"
echo "  Dashboard → http://localhost:3000"
echo "  API Docs  → http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both services."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
