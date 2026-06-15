# ULTRON — Industrial IoT Monitoring System

Real-time pressure and temperature monitoring platform for industrial equipment.
Supports **web dashboard** (browser) and **desktop application** (Windows/macOS/Linux via Tauri).

## Architecture

```
┌─────────────────────────┐     ┌─────────────────────────────┐
│   ULTRON Dashboard      │     │   ULTRON Desktop (Tauri)    │
│   (React + Vite)        │     │   (React + Vite + Rust)     │
│   Port 3000             │     │   Native window             │
└────────┬────────────────┘     └────────┬────────────────────┘
         │  HTTP / WebSocket             │  HTTP / WebSocket
         └──────────┬────────────────────┘
                    ▼
         ┌─────────────────────┐
         │   ULTRON Backend    │
         │   (FastAPI + Python)│
         │   Port 8000         │
         │   WS /ws @ 10 Hz   │
         │   Modbus TCP :5020  │
         │   SQLite persistence│
         └─────────────────────┘
```

## Quick Start

### Option 1 — Docker Compose (recommended for deployment)

```bash
cp .env.example .env          # adjust ports/settings if needed
docker compose up --build
```

- Dashboard: http://localhost:3000
- Backend API: http://localhost:8000/health
- API docs: http://localhost:8000/docs

### Option 2 — Local Development

**Prerequisites:** Node.js 20+, Python 3.11+

```bash
# 1. Backend
cd ultron-backend
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 2. Frontend (new terminal)
npm install                   # from project root
npm run dev:web               # dashboard at http://localhost:3000
```

### Option 3 — Desktop App (Tauri)

**Additional prerequisite:** Rust toolchain (`rustup`)

```bash
# Start the backend first (see above), then:
npm install
npm run dev:desktop
```

## Project Structure

```
ULTRON-PHASE-1/
├── ultron-backend/          # FastAPI backend (Python)
│   ├── app/                 # Application code
│   │   ├── main.py          # FastAPI app, REST + WS + lifespan
│   │   ├── config.py        # Typed settings from .env
│   │   ├── sensor_manager.py# Sensor abstraction (simulated + hardware)
│   │   ├── websocket_manager.py # WS broadcast with orjson
│   │   ├── database.py      # SQLite persistence layer
│   │   ├── modbus/          # Modbus TCP/RTU server subsystem
│   │   └── discovery/       # mDNS auto-discovery
│   ├── Dockerfile
│   └── requirements.txt
├── ultron-dashboard/        # Web dashboard (React + Vite)
│   ├── Dockerfile           # Multi-stage: Node build → Nginx
│   └── nginx.conf           # Reverse proxy + WS support
├── ultron-desktop/          # Desktop app (Tauri v2 + React + Vite)
│   └── src-tauri/           # Rust backend for native features
├── packages/
│   ├── hmi-core/            # Shared TypeScript types & interfaces
│   └── hmi-ui/              # Shared React UI components
├── docker-compose.yml       # One-command deployment
├── docs/                    # Architecture & protocol documentation
└── .env.example             # Docker Compose environment template
```

## Deployment

### Docker Compose (Web)

The `docker-compose.yml` starts:
- **backend**: FastAPI + uvicorn with orjson, GZip compression, uvloop
- **dashboard**: Nginx serving the built SPA, proxying API + WebSocket

```bash
docker compose up --build -d
```

### Desktop App (Windows/macOS/Linux)

```bash
cd ultron-desktop
npm run tauri:build
```

Produces platform-specific installers in `ultron-desktop/src-tauri/target/release/bundle/`.

### Raspberry Pi (Hardware Mode)

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full Pi setup including GPIO, I2C, and systemd service configuration.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe |
| GET | `/device` | Device metadata |
| GET | `/sensors/latest` | Latest cached reading |
| GET | `/api/sensors/history` | Historical readings from SQLite |
| GET | `/api/sensors/export` | CSV export |
| GET | `/api/device/identity` | Auto-discovery identity |
| POST | `/api/control/mode` | Switch simulated/hardware mode |
| GET | `/api/modbus/status` | Modbus subsystem status |
| GET | `/api/modbus/register-map` | Full register map docs |
| WS | `/ws` | Real-time sensor stream (10 Hz) |

## Performance Optimizations

- **orjson**: 3-10x faster JSON serialization for all API responses and WebSocket broadcasts
- **GZip middleware**: Automatic compression for responses > 500 bytes
- **uvloop + httptools**: High-performance event loop and HTTP parser (Docker production)
- **ORJSONResponse**: Custom FastAPI response class using orjson for all endpoints
- **Code splitting**: Vite manualChunks for vendor, charts, and state management libraries
- **SQLite WAL mode**: Write-ahead logging for concurrent read/write performance
- **Batched DB writes**: Sensor readings buffered and flushed every 1s to minimize I/O

## Configuration

All backend settings are configured via environment variables. See `ultron-backend/.env.example` for the full reference.

Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SIMULATED` | `true` | Use simulated sensors (set `false` on Pi) |
| `BROADCAST_INTERVAL_MS` | `100` | WebSocket publish rate (ms) |
| `PRESSURE_MAX` | `11.0` | Full-scale pressure range (bar) |
| `TEMPERATURE_MAX` | `115.0` | Full-scale temperature range (°C) |
| `DB_RETENTION_DAYS` | `30` | Auto-purge readings older than N days |

## Testing

```bash
# Backend tests (115 tests)
cd ultron-backend
source .venv/bin/activate
pytest tests/ -v

# Frontend type checking
npm run type-check
```

## License

Proprietary — Oswar Software
