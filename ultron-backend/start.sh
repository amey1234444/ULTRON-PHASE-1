#!/bin/sh
# ULTRON Backend Startup Script
# Ensures httpx is installed (even if Docker cache served stale image)
# then starts the uvicorn server.

echo "=== ULTRON startup: verifying dependencies ==="

# Install httpx if missing (handles Docker cache issue)
python -c "import httpx" 2>/dev/null || {
    echo "httpx not found, installing..."
    pip install --no-cache-dir "httpx>=0.27.0"
}

# Verify bridge_manager can import
python -c "from app.bridge_manager import BridgeManager; print('BridgeManager OK')" || {
    echo "ERROR: BridgeManager import failed!"
    echo "Installed packages:"
    pip list
    exit 1
}

echo "=== All dependencies verified, starting server ==="

exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers 1 \
    --loop uvloop \
    --http httptools
