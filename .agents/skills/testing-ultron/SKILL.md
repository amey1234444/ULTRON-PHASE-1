---
name: testing-ultron
description: Guide for testing the ULTRON industrial monitoring application end-to-end. Use when verifying UI changes, WebSocket connectivity, or deployment configuration.
---

## Architecture

Monorepo with npm workspaces:
- `ultron-backend/` — FastAPI + SQLite + WebSocket 10 Hz broadcast
- `ultron-dashboard/` — React + Vite (web SPA)
- `ultron-desktop/` — Tauri v2 (desktop app, shares UI with dashboard)
- `packages/hmi-ui/` — Shared React components (pages, charts, layout)

## Local Dev Setup

```bash
# Backend (terminal 1)
cd ultron-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Dashboard (terminal 2)
npm install        # from project root
npm run dev:web    # starts on port 3000
```

Backend runs in **simulated mode** by default (no hardware needed). It generates random pressure (4-11 bar) and temperature (50-115°C) data.

## Build & Lint Commands

```bash
npm run type-check          # TypeScript check all workspaces
npm run build               # Build both dashboard and desktop
cd ultron-backend && source .venv/bin/activate && pytest tests/ -q  # 115 tests
```

## UI Navigation Path

To reach the main dashboard with live data:
1. Open `http://localhost:3000`
2. Click **"Oswar Software"** in sidebar Asset Hierarchy
3. Click **"Phase 1 Demo Plant"**
4. Click **"Production Area A"**
5. Click **"RAV Line 01"** (auto-drills if only one child)
6. Click **"Feed System 01"** (auto-drills)
7. Click **"Rotary Airlock Valve"** in Equipment Type list
8. Now you can navigate to **Overview**, **Trends**, **Alarms**, etc. in the Monitor sidebar section

Without selecting an equipment type through the hierarchy, the main content area shows a placeholder prompting you to drill down.

## Key Pages to Test

- **Overview** — Pressure/temperature gauges, system health score, RAV schematic, mini trend chart
- **Trends** — Stats cards (latest/min/avg/max), combined/split view toggle, time range presets (15m/1h/6h/24h), export CSV
- **Alarms** — Alarm log with acknowledge UI
- **Monitoring** — Live sensor monitoring
- **Diagnostics** — System diagnostics
- **Devices/Maintenance/Reports** — Placeholder pages with styled UI

## Theme Toggle

Click the sun/moon icon button in the **top-right header** area. Verifies both dark (default) and light mode rendering.

## WebSocket Verification

The header bar shows connection status:
- Green dot + "CONNECTED" = WebSocket active
- "WS" + latency in ms = WebSocket round-trip time
- Live sensor values in stats cards should update every ~100ms

Note: High displayed WS latency (>1000ms) might occur when heavy chart rendering blocks the main thread — this doesn't necessarily mean the connection is slow.

## Deployment Options

1. **Docker Compose**: `docker compose up --build` — serves dashboard on :80, backend on :8000
2. **Static SPA**: Build `ultron-dashboard/dist/` and serve from any web server with API reverse proxy
3. **Desktop**: `npm run tauri:build` for Windows/macOS/Linux installers

## Devin Secrets Needed

No secrets required for local testing. The app runs fully in simulated mode.
