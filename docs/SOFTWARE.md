# SOFTWARE.md
## ULTRON — Software Architecture Reference

**Purpose:** Complete software reference for frontend, backend, and desktop engineers.
**Last Updated:** 2026-06-02
**Audience:** Frontend developers, backend developers, desktop/Tauri developers, AI agents

> Cross-references: [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | [API.md](API.md) | [MODBUS.md](MODBUS.md) | [UI_UX.md](UI_UX.md) | [HANDOFF.md](HANDOFF.md)

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Backend Architecture](#2-backend-architecture)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Desktop (Tauri) Architecture](#4-desktop-tauri-architecture)
5. [State Management](#5-state-management)
6. [Data Flow](#6-data-flow)
7. [Theme Architecture](#7-theme-architecture)
8. [Simulation Mode](#8-simulation-mode)
9. [Build System](#9-build-system)
10. [Coding Standards](#10-coding-standards)
11. [Future Roadmap](#11-future-software-roadmap)

---

## 1. Project Structure

```
ULTRON PHASE 1 DEMO/
├── ultron-backend/          Python FastAPI backend (runs on Raspberry Pi or PC)
├── ultron-desktop/          React + TypeScript + Tauri 2.x desktop application
├── ultron-discovery/        Standalone Python device discovery agent
├── HANDOFF.md               Session continuity document
├── HARDWARE.md              Hardware team reference
├── SOFTWARE.md              This file
├── SYSTEM_ARCHITECTURE.md   High-level system diagrams
├── API.md                   API endpoint documentation
├── MODBUS.md                Modbus register documentation
├── UI_UX.md                 UI/UX decisions and design system
└── [other engineering docs]
```

### Backend Structure

```
ultron-backend/
├── app/
│   ├── main.py              FastAPI entry point — all endpoints + WebSocket + lifespan
│   ├── config.py            Typed settings from .env (AppConfig, ServerConfig, etc.)
│   ├── models.py            Pydantic schemas — SensorReading, HealthResponse, etc.
│   ├── sensor_manager.py    Sensor abstraction — simulated + hardware classes
│   ├── websocket_manager.py WebSocket connection registry + broadcast
│   ├── logger.py            Rotating file + console logger
│   ├── modbus/
│   │   ├── register_map.py  All Modbus register addresses as constants
│   │   ├── modbus_service.py Central Modbus orchestrator (TCP + RTU)
│   │   ├── modbus_tcp_server.py pymodbus TCP server wrapper
│   │   ├── modbus_rtu_server.py pymodbus RTU server wrapper
│   │   ├── converters.py    Float32 / UInt32 encoding helpers
│   │   └── alarms.py        Alarm status calculation from readings
│   └── discovery/
│       └── mdns_advertiser.py Zeroconf mDNS advertisement
├── tests/
│   └── test_modbus.py
├── .env                     Configuration (copy from .env.example)
├── requirements.txt
└── README.md
```

### Frontend Structure

```
ultron-desktop/
├── src/
│   ├── main.tsx             React 18 entry point
│   ├── App.tsx              Root component — app phase state machine
│   ├── index.css            Tailwind directives + CSS variables (navy-steel palette)
│   ├── pages/
│   │   ├── SplashPage.tsx   Startup orchestrator (discovery + connection flow)
│   │   ├── DashboardPage.tsx Main dashboard (fixed-viewport, no scroll)
│   │   ├── MonitoringPage.tsx StatusPanel + SystemMetricsCard
│   │   ├── SettingsPage.tsx  Settings UI
│   │   └── DiagnosticsPage.tsx Diagnostics
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx       Collapsible nav (220px ↔ 56px)
│   │   │   ├── TopBar.tsx        Connection status, clock, theme toggle
│   │   │   └── MainLayout.tsx    Shell: Sidebar + TopBar + content area
│   │   ├── cards/
│   │   │   ├── SensorGauge.tsx   ECharts gauge (reusable)
│   │   │   ├── PressureCard.tsx  Pressure gauge + range bar + threshold labels
│   │   │   ├── TemperatureCard.tsx Temperature gauge + range bar
│   │   │   ├── HealthScoreCard.tsx Donut health score gauge (0–100)
│   │   │   └── SystemMetricsCard.tsx CPU/RAM/Disk/Temp progress bars
│   │   ├── charts/
│   │   │   ├── TrendChart.tsx    Single-series time-series (ECharts)
│   │   │   └── MultiTrendChart.tsx Dual-axis pressure+temperature (ResizeObserver)
│   │   ├── panels/
│   │   │   ├── AlarmPanel.tsx    Alarm table with ACK button
│   │   │   ├── StatusPanel.tsx   Connection/WebSocket status
│   │   │   └── ProcessOverview.tsx Digital twin panel (click-to-fullscreen)
│   │   ├── process/
│   │   │   ├── types.ts          SensorPoint, SensorStatus, SensorPhase types
│   │   │   ├── sensorPoints.ts   11 sensor metadata + buildSensorPoints()
│   │   │   ├── RotaryAirlockValveSvg.tsx Full SVG digital twin (900×560)
│   │   │   └── SensorDetailPanel.tsx Absolute-positioned sensor detail overlay
│   │   ├── discovery/
│   │   │   ├── DiscoveryScreen.tsx Device discovery UI
│   │   │   ├── DeviceCard.tsx    Single discovered device card
│   │   │   └── ManualConnect.tsx Manual IP/port input
│   │   └── ui/
│   │       ├── Panel.tsx         Base SCADA panel wrapper
│   │       ├── StatusBadge.tsx   Status indicator pill
│   │       ├── GlassCard.tsx     Glass-morphism card
│   │       └── ClockDisplay.tsx  Real-time clock
│   ├── config/
│   │   └── constants.ts     LIMITS (pressure/temperature thresholds), chart config
│   ├── context/
│   │   └── ThemeContext.tsx  Dark/light theme with localStorage
│   ├── hooks/
│   │   ├── useWebSocket.ts  WebSocket connection + auto-reconnect
│   │   ├── useDeviceDiscovery.ts mDNS + subnet scan discovery
│   │   └── useDeviceInfo.ts Fetch device identity
│   ├── store/
│   │   ├── sensorStore.ts   Zustand: readings[], latest, healthScore, alarms
│   │   ├── connectionStore.ts Zustand: wsUrl, connectionStatus, deviceInfo
│   │   └── appStore.ts      Zustand: appPhase, activeView, settings
│   ├── types/
│   │   └── sensor.ts        TypeScript types: SensorReading, DeviceInfo, etc.
│   └── utils/
│       ├── formatters.ts    getSensorStatus(), computeHealthScore(), colors
│       └── cn.ts            Tailwind class name utility (clsx wrapper)
├── src-tauri/               Tauri 2.x Rust backend
│   └── src/
│       ├── main.rs
│       ├── backend_manager.rs  Spawns/manages Python backend process
│       ├── device_discovery.rs Tauri commands for device discovery
│       ├── modbus_discovery.rs Modbus TCP probe for discovery
│       ├── config_store.rs     Persistent app config (JSON file)
│       └── commands.rs         Tauri command handlers
├── index.html
├── package.json             React 18, Tauri, TypeScript, ECharts, Zustand, Tailwind
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 2. Backend Architecture

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Web framework | FastAPI | 0.104+ |
| ASGI server | Uvicorn | Latest |
| Data validation | Pydantic v2 | 2.x |
| Modbus | pymodbus | 3.x |
| mDNS | zeroconf | Latest |
| Config | python-dotenv | Latest |
| Python | CPython | 3.11+ |

### Application Lifecycle

On startup (via FastAPI `lifespan` context manager):
1. Load settings from `.env`
2. `SensorManager.initialise()` — select simulated or hardware sensors
3. `ModbusService.start()` — start TCP and/or RTU servers if enabled
4. `MDNSAdvertiser.start_async()` — advertise `_ultron._tcp.local.`
5. Start `_sensor_loop()` asyncio task

On shutdown:
1. Cancel `_sensor_loop` task
2. `ModbusService.stop()`
3. `MDNSAdvertiser.stop_async()`

### Sensor Loop

Runs every 100 ms (configurable `BROADCAST_INTERVAL_MS`):

```
1. Read P1 pressure + MT2 temperature concurrently (asyncio.gather)
2. Derive system status (healthy / warning / critical)
3. Broadcast SensorReading JSON to all WebSocket clients
4. Update all Modbus Input Registers with new values
```

### Sensor Abstraction

```python
BaseSensor (ABC)
├── SimulatedPressureSensor   # Industrial pump oscillation + noise + spike events
├── SimulatedTemperatureSensor # Thermal cycle + load ripple + overheat spikes
├── HardwarePressureSensor     # TODO: ADS1115 I2C ADC driver (currently NotImplementedError)
└── HardwareTemperatureSensor  # DS18B20 1-Wire via /sys/bus/w1/devices/
```

`SIMULATED=true` (default) → uses simulated sensors.
`SIMULATED=false` → uses hardware sensors (requires Raspberry Pi GPIO/I2C).

### Alarm Thresholds (derived from config)

```python
PRESSURE_WARNING  = pressure_max × 0.80  = 15.0 × 0.80 = 12.0 bar  (config default)
PRESSURE_CRITICAL = pressure_max × 0.95  = 15.0 × 0.95 = 14.25 bar
TEMP_WARNING      = temp_max × 0.80      = 120.0 × 0.80 = 96.0 °C
TEMP_CRITICAL     = temp_max × 0.95      = 120.0 × 0.95 = 114.0 °C
```

> Frontend uses its own constants (see [constants.ts](ultron-desktop/src/config/constants.ts)):
> `pressure warning=8.8, critical=10.45` / `temperature warning=92.0, critical=109.25`
> These must stay in sync with `.env` values.

### REST Endpoints Summary

See [API.md](API.md) for full documentation.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness probe |
| GET | `/device` | Device metadata |
| GET | `/api/device/identity` | Auto-discovery identity |
| GET | `/sensors/latest` | Latest sensor snapshot (REST) |
| GET | `/api/modbus/status` | Modbus runtime status |
| GET | `/api/modbus/register-map` | Full register documentation |
| WS | `/ws` | Live sensor stream (100 ms) |

---

## 3. Frontend Architecture

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI framework | React | 18.x |
| Language | TypeScript | 5.x |
| Charts | ECharts (via echarts-for-react) | 5.5+ |
| State management | Zustand | 4.5 |
| CSS framework | Tailwind CSS | 3.4 |
| Build tool | Vite | 5.x |
| Icons | Lucide React | Latest |

### App Phase State Machine

`App.tsx` controls top-level application phase:

```
'splash'
   ↓ (backend check + discovery)
'discovery'          ← if no known device
   ↓ (device selected)
'connected'          ← live WebSocket data
'simulation'         ← no device found — using simulated backend
'settings'           ← settings page
'diagnostics'        ← diagnostics page
```

### Page Routing

Routing is handled by `MainLayout.tsx` switching on `activeView` from `appStore`:

| View Key | Component | Description |
|----------|-----------|-------------|
| `overview` | `DashboardPage` | Main gauges + digital twin + trend |
| `trends` | `DashboardPage (trendsOnly)` | Trend charts only |
| `alarms` | `DashboardPage (alarmsOnly)` | Alarm panel only |
| `monitoring` | `MonitoringPage` | StatusPanel + SystemMetricsCard |
| `settings` | `SettingsPage` | Settings |
| `diagnostics` | `DiagnosticsPage` | Diagnostics |

### Dashboard Layout

`DashboardPage` uses a **fixed-viewport flex layout** (no scroll):

```
┌─────────────────────────────────────────────────────┐
│ Row 1 (fixed height ~180px)                         │
│  [PressureCard]  [TemperatureCard]  [HealthScore]   │
├─────────────────────────────────────────────────────┤
│ Row 2 (flex: 1, fills remaining height)             │
│  [ProcessOverview 2/3]  │  [MultiTrendChart 1/3]   │
└─────────────────────────────────────────────────────┘
```

### Key TypeScript Types

```typescript
// ultron-desktop/src/types/sensor.ts
interface SensorReading {
  timestamp: string;       // ISO-8601 UTC
  pressure: number;        // bar
  temperature: number;     // °C
  status?: 'healthy' | 'warning' | 'critical' | 'offline';
}

interface DeviceInfo {
  device_id: string;
  app_name: string;
  version: string;
  pressure_sensor: string;
  temperature_sensor: string;
  broadcast_interval_ms: number;
  mode: string;            // 'simulated' | 'hardware'
}
```

---

## 4. Desktop (Tauri) Architecture

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2.x |
| Language (native) | Rust |
| Frontend | React 18 + TypeScript (Vite) |
| Target OS | Windows (primary), Linux |

### What Tauri Provides

- **Native window** — no browser chrome, no URL bar
- **System tray** (future) — minimize to tray
- **Backend process management** — `backend_manager.rs` spawns/monitors the Python Uvicorn process
- **File system access** — config persistence via `config_store.rs`
- **Tauri commands** — Rust functions callable from JavaScript via `invoke()`

### Tauri Commands (Rust → JS bridge)

| Command | Purpose |
|---------|---------|
| `discover_devices` | Trigger mDNS + subnet scan discovery |
| `probe_modbus_device` | Attempt Modbus TCP connection to an IP |
| `get_config` | Read persisted app config |
| `set_config` | Write persisted app config |
| `start_backend` | Spawn Python backend process |
| `stop_backend` | Kill Python backend process |

### Backend Process Management

`backend_manager.rs` resolves the path to the bundled Python backend:
- Development: looks for `../ultron-backend/` relative to project
- Production: looks inside Tauri resource directory

> **Known issue:** Path resolution on first production run is unverified. Test before shipping.

---

## 5. State Management

Three Zustand stores, all in `ultron-desktop/src/store/`:

### sensorStore

```typescript
{
  readings: SensorReading[]    // Up to MAX_HISTORY=1000 entries (ring buffer)
  latest: SensorReading | null // Most recent reading
  healthScore: number          // 0–100 computed score
  alarms: {
    highPressure: boolean      // pressure ≥ 8.8 bar
    criticalPressure: boolean  // pressure ≥ 10.45 bar
    highTemperature: boolean   // temperature ≥ 92.0 °C
    criticalTemperature: boolean // temperature ≥ 109.25 °C
  }
}
```

### connectionStore

```typescript
{
  wsUrl: string | null                              // e.g. "ws://192.168.1.100:8000/ws"
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error'
  reconnectCount: number
  deviceInfo: DeviceInfo | null
  discoveredDevices: DiscoveredDevice[]
}
```

### appStore

```typescript
{
  appPhase: 'splash' | 'discovery' | 'connected' | 'simulation' | 'settings' | 'diagnostics'
  activeView: 'overview' | 'trends' | 'alarms' | 'monitoring' | ...
  sidebarCollapsed: boolean
  isDarkMode: boolean
}
```

---

## 6. Data Flow

### Live Sensor Reading Flow

```
Raspberry Pi Hardware (P1, MT2)
         ↓
SensorManager.read() every 100ms
         ↓
SensorReading(timestamp, pressure, temperature, status)
         ↓  (broadcast)
WebSocketManager → all connected clients
         ↓  (also)
ModbusService.update_registers() → Modbus registers 30001–30215
         ↓
[WebSocket client — Tauri app]
useWebSocket() hook receives JSON
         ↓
sensorStore.addReading(reading)
  - appends to readings[]
  - updates latest
  - recomputes healthScore
  - evaluates alarms
         ↓
React components re-render via Zustand subscriptions:
  - PressureCard → latest.pressure
  - TemperatureCard → latest.temperature
  - HealthScoreCard → healthScore
  - MultiTrendChart → readings[] (last N points)
  - AlarmPanel → alarms{}
  - ProcessOverview → buildSensorPoints(latest) → RotaryAirlockValveSvg
```

### Health Score Calculation

```typescript
// utils/formatters.ts
function computeHealthScore(pressure: number, temperature: number): number {
  // Each sensor penalizes the score based on proximity to critical threshold
  // 0 penalty below warning threshold
  // Up to 65 points penalty at critical threshold
  // Exponential above critical
  // Returns score 0–100 (100 = perfectly healthy)
}
```

---

## 7. Theme Architecture

### CSS Variables (Dark Mode — Locked Option 3 SCADA)

Defined in `ultron-desktop/src/index.css`:

```css
:root {
  --surface:    #060C18;  /* deep ocean navy — page background */
  --panel:      #0C1A28;  /* dark steel — panel background */
  --panel-alt:  #122233;  /* raised surface — panel header */
  --border:     #1A3048;  /* panel border */
  --border-hi:  #2A4A6A;  /* highlighted border */
  --text:       #CDE4F8;  /* bright cool white — primary text */
  --text-2:     #6AAED0;  /* steel blue — secondary text */
  --text-3:     #3A5E7A;  /* subdued — tertiary */
  --accent:     #38A0FF;  /* electric blue — active state */
  --ok:         #20D068;  /* vivid green — healthy */
  --warn:       #FFB020;  /* golden amber — warning */
  --crit:       #FF4040;  /* vivid red — critical */
  --sidebar:    #040810;  /* near-black navy — sidebar */
}
```

### Theme Switching

- `ThemeContext.tsx` provides `{ isDark, toggle }` to all components
- Theme stored in `localStorage` as `'dark'` or `'light'` class on `<html>`
- Light theme CSS variables are overrides in `html.light { ... }`

> The dark navy-steel palette (Option 3 SCADA) is the **primary locked design**.
> See [UI_UX.md](UI_UX.md) and [DECISIONS.md](DECISIONS.md).

---

## 8. Simulation Mode

When no physical Raspberry Pi is available:

1. Backend starts with `SIMULATED=true` (default)
2. `SimulatedPressureSensor` and `SimulatedTemperatureSensor` generate realistic data:
   - Pressure: 7.0 ± 0.85 bar base oscillation, plus ripple and random spikes
   - Temperature: 80.0 ± 7.5 °C thermal cycle, plus load ripple and overheat spikes
3. Spikes occasionally exceed warning/critical thresholds — exercises alarm logic
4. Dashboard shows **"SIMULATION MODE"** banner (yellow) when `mode === 'simulated'`
5. All features (WebSocket, Modbus, mDNS) work identically in simulation mode

To switch to hardware mode: set `SIMULATED=false` in `.env` and ensure GPIO/I2C is wired.

---

## 9. Build System

### Backend

- Python virtual environment (`.venv`)
- `requirements.txt` — managed manually
- No containerisation in Phase 1 (future: Docker)
- On Raspberry Pi: runs as systemd service

### Frontend

| Tool | Purpose |
|------|---------|
| Vite 5 | Dev server + production bundler |
| TypeScript 5 | Type checking (`npm run type-check`) |
| Tailwind CSS 3.4 | Utility-class styling |
| PostCSS | Tailwind + autoprefixer pipeline |
| Tauri CLI | `tauri dev` / `tauri build` |
| Cargo | Rust compilation (Tauri native layer) |

### Production Build Output

```
ultron-desktop/src-tauri/target/release/bundle/
├── nsis/ULTRON_1.0.0_x64-setup.exe    Windows installer
└── msi/ULTRON_1.0.0_x64_en-US.msi    MSI package (if configured)
```

---

## 10. Coding Standards

### Python (Backend)

- Type annotations required on all function signatures
- Pydantic models for all API request/response schemas
- `async/await` throughout — no blocking I/O in async context (use `run_in_executor` for blocking calls)
- `logger` from `app.logger` — never use `print()`
- Config from `settings` (AppConfig) — never hardcode values
- Environment variables via `.env` — never commit secrets

### TypeScript (Frontend)

- Strict TypeScript — no `any` types
- Zustand for all global state — no prop-drilling
- `LIMITS` from `constants.ts` for all threshold comparisons
- CSS variables for all colors — never hardcode hex in component styles
- `cn()` utility for conditional Tailwind classes
- `ResizeObserver` for chart sizing — no fixed pixel heights in charts

### General

- No magic numbers — name every threshold and constant
- Cross-reference [DECISIONS.md](DECISIONS.md) before changing architecture
- Update [HANDOFF.md](HANDOFF.md) when completing significant work

---

## 11. Future Software Roadmap

See [ROADMAP.md](ROADMAP.md) for full roadmap.

| Phase | Software Changes |
|-------|----------------|
| Phase 2 | Add BT1, BT2, RPM1, M1 sensor tags; new gauges; bearing trend charts |
| Phase 2 | Data persistence — SQLite or InfluxDB (see [DATABASE.md](DATABASE.md)) |
| Phase 3 | FFT vibration analysis; machine health scoring algorithm |
| Phase 3 | Predictive maintenance alerts with trend extrapolation |
| Phase 4 | Multi-machine support; gateway device types (UM Card, TP Card) |
| Phase 5 | Cloud sync; fleet monitoring; remote dashboard |
| Future | MQTT support; OPC-UA support |
| Future | Authentication — JWT or API key |
| Future | Role-based access control |
