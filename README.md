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

### Option A — Docker Compose (Self-Hosted)

The `docker-compose.yml` starts both backend and dashboard:

```bash
docker compose up --build -d
```

- **backend**: FastAPI + uvicorn with orjson, GZip compression, uvloop
- **dashboard**: Nginx serving the built SPA, proxying API + WebSocket to backend

### Option B — Deploy Dashboard on Existing Website (Static Hosting)

The dashboard builds to a static SPA (`ultron-dashboard/dist/`) that can be
served from any web server (Nginx, Apache, S3, Netlify, Vercel, etc.).

**Step 1: Build the dashboard**
```bash
npm install                  # from project root
cd ultron-dashboard && npm run build
```

**Step 2: Copy `dist/` contents to your website**
Upload the files in `ultron-dashboard/dist/` to your web server's document root
(or a subdirectory).

**Step 3: Configure API proxy on your existing web server**

The dashboard connects to the backend via `/ws`, `/api/*`, `/health`, `/device`,
and `/sensors/*` paths. Your existing web server must reverse-proxy these paths
to the ULTRON backend.

**Nginx example** (add to your existing server block):
```nginx
# ULTRON API proxy
location /api/ {
    proxy_pass http://BACKEND_HOST:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
location /health { proxy_pass http://BACKEND_HOST:8000; }
location /device { proxy_pass http://BACKEND_HOST:8000; }
location /sensors/ { proxy_pass http://BACKEND_HOST:8000; }

# WebSocket proxy
location /ws {
    proxy_pass http://BACKEND_HOST:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400s;
}

# SPA fallback (serve index.html for all other routes)
location / {
    try_files $uri $uri/ /index.html;
}
```

Replace `BACKEND_HOST` with the IP/hostname of the machine running the backend.

**Apache example** (in `.htaccess` or VirtualHost):
```apache
RewriteEngine On
# API proxy
ProxyPass /api/ http://BACKEND_HOST:8000/api/
ProxyPassReverse /api/ http://BACKEND_HOST:8000/api/
ProxyPass /ws ws://BACKEND_HOST:8000/ws
ProxyPassReverse /ws ws://BACKEND_HOST:8000/ws
ProxyPass /health http://BACKEND_HOST:8000/health
ProxyPass /device http://BACKEND_HOST:8000/device
# SPA fallback
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ /index.html [L]
```

**Step 4: Run the backend**

On the backend server:
```bash
cd ultron-backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Or via Docker:
```bash
docker compose up backend -d
```

### Option C — Desktop App (Windows/macOS/Linux)

```bash
cd ultron-desktop
npm run tauri:build
```

Produces platform-specific installers:
- **Windows**: NSIS installer (`.exe`) and MSI
- **macOS**: DMG disk image
- **Linux**: AppImage and `.deb` package

Output location: `ultron-desktop/src-tauri/target/release/bundle/`

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
| POST | `/api/bridges/register` | Register a bridge URL for the backend to **poll** (pull mode) |
| POST | `/api/bridges/ingest` | Receive a reading **pushed** by a bridge (push mode) |
| GET | `/api/bridges` | List registered bridges and their status |
| DELETE | `/api/bridges/{id}` | Unregister a bridge |
| WS | `/ws` | Real-time sensor stream (10 Hz) |

## Bridge Data Acquisition (`ultron_bridge.py`)

`ultron_bridge.py` is a standalone script that exposes pressure/temperature data
(synthetic in `--mode dummy`, or parsed from an STM32 page in `--mode hardware`).
There are two ways to get its data into the backend → dashboard:

### Pull mode (backend polls the bridge) — for LAN deployments

Use when the **backend can reach the bridge** over the network (same LAN, or the
bridge has a public/forwarded address).

```bash
python ultron_bridge.py --mode dummy --port 8765
```

Then add the bridge in the dashboard **Settings → Bridge Configuration** as
`http://<bridge-ip>:8765`. The backend polls `{url}/api/live` every second and
broadcasts the readings over WebSocket.

> ⚠️ If the backend is hosted in the cloud (e.g. Render) and the bridge runs on a
> private LAN (`192.168.x.x` / `localhost`), the cloud backend **cannot** reach
> back into your network, so polling will fail. Use push mode instead.

### Push mode (bridge pushes to the backend) — for cloud backends / NAT

Use when the **bridge can reach the backend** (outbound internet) but not the
other way around. The bridge POSTs each reading to `/api/bridges/ingest`, so it
works through NAT/firewalls with no port forwarding.

```bash
python ultron_bridge.py --mode dummy \
    --push-url https://ultron-backend-pakd.onrender.com \
    --source BRIDGE-001
```

No manual registration is needed — the bridge appears automatically under
**Settings → Bridge Configuration** (labelled `PUSH`) once it starts pushing, and
its data streams straight to the dashboard.

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
