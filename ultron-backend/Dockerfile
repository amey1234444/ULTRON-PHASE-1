# ── ULTRON Backend ── production image (v3 - guaranteed httpx)
FROM python:3.12-slim AS base

# Prevent Python from writing .pyc and enable unbuffered stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install ALL dependencies including httpx explicitly
COPY requirements.txt .
RUN pip install --no-cache-dir "httpx>=0.27.0" \
    && pip install --no-cache-dir -r requirements.txt \
    && python -c "import httpx; print(f'httpx {httpx.__version__} OK')" \
    && python -c "import fastapi, uvicorn, websockets, pydantic, orjson; print('core deps OK')"

# Copy application code and startup script
COPY start.sh .
COPY app/ app/
COPY data/ data/

# Verify all critical imports work at build time
RUN python -c "from app.bridge_manager import BridgeManager; print('BridgeManager imports OK')" \
    && python -c "from app.main import app; print('FastAPI app imports OK')"

# Default environment: simulated mode, all features enabled
ENV SIMULATED=true \
    HOST=0.0.0.0 \
    PORT=8000 \
    BROADCAST_INTERVAL_MS=100 \
    DB_ENABLED=true \
    DB_PATH=/app/data/ultron.db \
    MODBUS_TCP_ENABLED=true \
    MODBUS_TCP_PORT=5020 \
    MODBUS_RTU_ENABLED=false \
    MDNS_ENABLED=false \
    LOG_LEVEL=INFO

EXPOSE 8000 5020

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8000}/health')" || exit 1

# Use startup script: verifies httpx at runtime, installs if missing, then launches
CMD ["sh", "/app/start.sh"]
