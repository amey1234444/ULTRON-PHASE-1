# ── ULTRON Backend ── multi-stage build for minimal production image
FROM python:3.12-slim AS base

# Prevent Python from writing .pyc and enable unbuffered stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies (copy + install in single layer to avoid cache staleness)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -c "import httpx; print(f'httpx {httpx.__version__} OK')"

# Copy application code
COPY app/ app/
COPY data/ data/

# Verify all critical imports work at build time
RUN python -c "from app.bridge_manager import BridgeManager; print('bridge_manager imports OK')"

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

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --loop uvloop --http httptools"]
