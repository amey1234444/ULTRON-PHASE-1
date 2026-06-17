# HANDOFF.md
## ULTRON — Session Continuity Document

**Purpose:** Enable any developer or AI agent to resume work immediately without prior chat history.
**Last Updated:** 2026-06-04
**Current Phase:** Phase 1 MVP — Phase 13 complete (Live Hardware Commissioning)

> Cross-references: [SOFTWARE.md](SOFTWARE.md) | [HARDWARE.md](HARDWARE.md) | [ROADMAP.md](ROADMAP.md) | [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)

---

## 1. Project Summary

ULTRON is an **Industrial Machine Monitoring Platform** built by Oswar Software / Oswar Rotocorp.

- **Edge device:** Raspberry Pi 4 — reads sensors, runs FastAPI + WebSocket + Modbus server
- **Desktop app:** Tauri 2.x (Windows/Linux) — React 18 + TypeScript dashboard
- **Phase 1 machine:** Rotary Airlock Valve — monitoring Pressure (P1) and Temperature (MT2)
- **Mode:** Pi at `192.168.1.14` running in **HARDWARE mode** — ADS1115 pressure sensor active, DS18B20 not yet wired

---

## 2. Current Status

| Area | Status |
|------|--------|
| FastAPI backend + WebSocket stream | ✅ Complete |
| Simulated pressure + temperature sensors | ✅ Complete |
| Modbus TCP server (port 5020) | ✅ Complete |
| Modbus RTU server | ✅ Implemented — untested on physical RS485 |
| mDNS auto-discovery | ✅ Complete |
| Tauri 2.x desktop shell | ✅ Complete |
| ECharts gauges (Pressure, Temperature, Health) | ✅ Complete |
| Dual-axis MultiTrendChart | ✅ Complete |
| Rotary Airlock Valve digital twin SVG (11 sensors) | ✅ Complete |
| Click-to-fullscreen digital twin | ✅ Complete |
| Fixed-viewport dashboard (no scroll) | ✅ Complete |
| MonitoringPage (StatusPanel + SystemMetricsCard) | ✅ Complete |
| Navy-steel dark theme — Option 3 SCADA palette | ✅ Complete — **LOCKED** |
| **Connection architecture (Phase 10)** | ✅ Complete |
| **WebSocket primary data source + latency tracking** | ✅ Complete |
| **Modbus TCP fallback (Rust reader + TS service)** | ✅ Complete |
| **Client-side simulation fallback (no backend)** | ✅ Complete |
| **Service layer (7 service files)** | ✅ Complete |
| **StatusPanel: latency + Machine ID + protocol badge** | ✅ Complete |
| **TopBar: latency + active protocol display** | ✅ Complete |
| TypeScript: 0 errors | ✅ |
| Cargo (Rust): 0 errors | ✅ |
| Hardware pressure sensor driver (ADS1115) | ✅ Implemented — ADS1115 I2C, 4–20 mA |
| **Phase 12: machine_id in backend identity response** | ✅ Complete |
| **Phase 12: local subnet auto-detection in discovery** | ✅ Complete |
| **Phase 12: ConnectionManager WS recovery bug fixed** | ✅ Fixed |
| **Phase 12: get_local_ip Tauri command** | ✅ Complete |
| **Phase 13: pymodbus pinned to 3.6.9 (3.13 broke API)** | ✅ Fixed |
| **Phase 13: Modbus TCP server running (port 5020)** | ✅ Verified live |
| **Phase 13: null temperature accepted by WebSocket service** | ✅ Fixed |
| **Phase 13: TemperatureCard shows NO SENSOR when DS18B20 absent** | ✅ Complete |
| **Phase 13: False CRITICAL alarms suppressed for null temp** | ✅ Fixed |
| **Phase 13: Pi connected — live pressure readings in dashboard** | ✅ 192.168.1.14 |
| Production `.exe` build tested | ❌ Not yet verified |
| CORS restricted for production | ❌ Currently `allow_origins=["*"]` |
| DS18B20 temperature sensor wired | ❌ Not yet — shows NO SENSOR in dashboard |
| Pressure transmitter 24VDC loop powered | ❌ ADS1115 reading ~0 bar (sensor needs loop supply) |

---

## 3. Phase 13 — Live Hardware Commissioning (2026-06-04)

### Context
Pi at `192.168.1.14` was brought online. Dashboard connected via WebSocket but showed `0.00 bar / 0.00 °C` with CRITICAL alarms. Root cause: the Pi's backend sends a payload that differs from what the frontend expected.

### Pi Backend Payload (actual — differs from codebase model)

```json
{
  "timestamp": "2026-06-04T12:10:47.853Z",
  "machine_id": "RAV-01",
  "pressure": 0.005,
  "temperature": null,
  "status": "healthy",
  "mode": "hardware",
  "sequence": 30457
}
```

Key differences from `SensorReading` type: extra fields (`machine_id`, `mode`, `sequence`) and `temperature: null` (DS18B20 not wired).

---

### Bug 1 — WebSocket frames silently dropped (CRITICAL)

**File:** `ultron-desktop/src/services/websocket/WebSocketService.ts`

**Old guard:**
```typescript
if (typeof data.pressure === 'number' && typeof data.temperature === 'number')
```

`typeof null === 'object'` → condition always false → **every frame discarded** → gauges stuck at 0.00 → CRITICAL alarms.

**Fix:** Accept readings when only pressure is present — temperature is optional:
```typescript
if (typeof data.pressure === 'number')
```

---

### Bug 2 — False CRITICAL temperature alarms

**File:** `ultron-desktop/src/store/sensorStore.ts`

`null <= 55.0` coerces `null → 0` in JS → `0 <= 55 = true` → `llTemperature` alarm fires even with no sensor.

**Fix:** Guard all temperature alarm comparisons with `t !== null &&`:
```typescript
llTemperature: t !== null && t <= tt.ll,
```

---

### Bug 3 — pymodbus 3.13.0 broke Modbus server

**File:** `ultron-backend/requirements.txt`

pymodbus 3.13 changed its entire datastore API. `ModbusSlaveContext`, `ModbusSequentialDataBlock(0, ...)`, and `ModbusDeviceIdentification` all broke. Backend crashed at startup.

**Fix:** Pinned to `pymodbus>=3.6.0,<3.7.0` (3.6.9 installed). All original API calls work.

---

### All Phase 13 Changes

| File | Change |
|------|--------|
| `types/sensor.ts` | `temperature: number \| null` + added optional `machine_id`, `mode`, `sequence` fields |
| `services/websocket/WebSocketService.ts` | Guard: accept frame if `pressure` is a number (null temp OK) |
| `store/sensorStore.ts` | Temperature alarms: `t !== null &&` guard on every comparison |
| `utils/formatters.ts` | `computeHealthScore(p, null)` — skips temp penalty when null |
| `components/cards/SensorGauge.tsx` | Added `noData?: boolean` prop — shows `—` and greyed needle |
| `components/cards/TemperatureCard.tsx` | Shows "NO SENSOR" badge when `temperature === null`; suppresses alarms |
| `components/charts/MultiTrendChart.tsx` | Null temperatures render as gaps in ECharts line |
| `components/charts/TrendChart.tsx` | Same — `r.temperature ?? null` |
| `components/process/sensorPoints.ts` | MT2 status stays `normal` when temperature is null |
| `requirements.txt` | `pymodbus>=3.6.0,<3.7.0` (was `<4.0.0`) |
| `ultron-backend/start_backend.bat` | Launcher that activates venv before starting uvicorn (for Windows `Start-Process`) |

---

### Hardware Status (as of 2026-06-04)

| Component | Status | Notes |
|-----------|--------|-------|
| Raspberry Pi 4 | ✅ Online | IP: 192.168.1.14 |
| FastAPI + WebSocket | ✅ Running | port 8000, 10 Hz |
| Modbus TCP | ✅ Running | port 5020, 220 registers |
| mDNS | ✅ Advertising | `ultron-edge.local` |
| ADS1115 ADC | ✅ Detected | I2C 0x48, reading channel AIN0 |
| P1 Pressure transmitter | ⚠️ Reads ~0 bar | Sensor present but 24VDC loop supply not connected — ADS1115 sees ~1V (4mA minimum) |
| DS18B20 Temperature | ❌ Not wired | Dashboard shows "NO SENSOR" — no alarm triggered |
| ULTRON Desktop | ✅ Connected | `WS` badge, CONNECTED status, pressure updating live |

---

### Pressure Reading Interpretation

ADS1115 reading ~0.005–0.008 bar = roughly 1.001–1.002V on AIN0.

```
voltage = current × 250Ω
1.001V / 250Ω = 4.004mA  ← minimum loop current (sensor alive, no pressure applied)
```

The pressure transmitter IS alive on the loop — 4mA = 0 bar on its scale. The reading will become meaningful once:
1. The 24VDC loop supply is wired between the transmitter and ADS1115
2. The transmitter is exposed to process pressure (0–10 bar)

---

### How to Start the Backend (Windows Dev Machine)

```powershell
# Option A — PowerShell (recommended, keeps console open)
cd "e:\Oswar Software\ULTRON\ULTRON PHASE 1 DEMO\ULTRON Phase 1\ultron-backend"
& ".\.venv\Scripts\Activate.ps1"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info

# Option B — Batch file (double-click from Explorer)
start_backend.bat
```

> **Warning:** Do NOT use `Start-Process` with a new PowerShell window to launch the backend.
> The new window may use the system Python instead of the venv Python,
> causing pymodbus and other packages to be "not installed".
> Always activate the venv explicitly before running `python`.

---

## 4. Phase 12 — Connection Architecture: LAN-Ready (2026-06-04)

### What Was Fixed / Added

#### Critical Bug Fixes
| Bug | File | Fix |
|-----|------|-----|
| Modbus not stopped when WS recovers | `ConnectionManager.ts` | Added `_stopModbus()` + `_stopSim()` call inside `onStatusChange('connected')` handler |
| Multiple Modbus instances created after repeated WS failures | `ConnectionManager.ts` | Added `_demoted` flag — demotion only fires once per WS session |
| Modbus readings leaking into WS session after recovery | `ConnectionManager.ts` | Added guard: Modbus `onReading` returns early if `_protocol === 'websocket'` |
| `wsFailuresBeforeModbus` too high (15 s wait) | `ConnectionTypes.ts` | Reduced from 5 → 3 failures (~9 s before fallback) |

#### Discovery Improvements
| Improvement | File | Details |
|-------------|------|---------|
| Local subnet auto-detection | `device_discovery.rs` | UDP socket trick (`connect 8.8.8.8:53`) detects machine's real LAN IP; its /24 subnet scanned first |
| 192.168.10.x range added | `device_discovery.rs` | Covers `192.168.10.10` (known Pi IP in spec) and other 192.168.{2–20} ranges |
| `get_local_ip` Tauri command | `commands.rs` + `main.rs` | Exposes local IP to the frontend |

#### machine_id Propagation (end-to-end)
| Layer | Change |
|-------|--------|
| Python backend: `config.py` | Added `machine_id = os.getenv("MACHINE_ID", "RAV-01")` |
| Python backend: `models.py` | Added `machine_id: str` field to `DeviceIdentityResponse` |
| Python backend: `main.py` | Returns `machine_id` from `GET /api/device/identity` |
| Python backend: `.env` | Added `MACHINE_ID=RAV-01` |
| Rust: `device_discovery.rs` | `DeviceInfo` now has `machine_id: Option<String>` parsed from JSON |
| TypeScript: `types/tauri.ts` | `TauriDeviceInfo.machine_id?: string` |
| TypeScript: `connectionStore.ts` | `ConnectionConfig.machineId: string` populated by `deviceInfoToConfig()` |
| TypeScript: `tauriCommands.ts` | Added `getLocalIp(): Promise<string>` |
| UI: `StatusPanel.tsx` | Machine ID row reads `config?.machineId ?? DEFAULT_MACHINE_ID` |

### Connection Priority (as implemented)

```
ULTRON.exe launches
     ↓
SplashPage: load settings → start backend → discover devices
     ↓
Discovery sequence (Rust, src-tauri/src/device_discovery.rs):

  [1] Last-known IP (saved from previous session)
      Probe http://<ip>:8000/api/device/identity  ← 2 s timeout
      ↓ found → navigate to dashboard
      ↓ not found → continue

  [2] mDNS / hostname probes (parallel):
      ultron-edge.local, raspberrypi.local, localhost
      ↓ any found → navigate to dashboard
      ↓ none found → continue

  [3] Subnet scan — 30-address batches:
      • Detected local /24 subnet first (e.g. 192.168.10.x if machine is .10.5)
      • Then 192.168.{0,1,2–20,50,100}.x
      • Then 10.0.0.x, 10.0.1.x, 10.10.0.x, 172.16.0.x
      Stops as soon as first device is found.

  [4] Manual entry:
      DiscoveryScreen "Enter IP manually" → ManualConnect component
      SettingsPage Device Connection → editable IP + "Connect to Device"

  [5] Simulation mode:
      SplashPage: "Continue in Simulation Mode" or "Skip — use simulation"
      Uses ws://localhost:8000/ws or pure client-side sim

     ↓ device found → connectionStore.setConfig({apiBase, wsUrl, machineId, ...})
     ↓ enter dashboard → useConnectionManager() starts ConnectionManager
```

### Data Flow After Connection

```
ConnectionManager (WS primary):
  ws://<Pi-IP>:8000/ws
  ↓ 100ms readings → sensorStore.addReading(r, latencyMs, 'websocket')

  ↗ WS fails 3× → Modbus TCP fallback:
       Tauri read_modbus_tcp(<Pi-IP>, 5020, 1) every 250 ms
       ↓ → sensorStore.addReading(r, 0, 'modbus')

  ↗ Modbus fails 5× → client-side simulation:
       generateSimReading() every 100 ms
       ↓ → sensorStore.addReading(r, 0, 'simulation-client')

  ↗ WS reconnects at any tier → Modbus/sim stopped, WS promoted
```

### FALLBACK_CONFIG (current values)
| Parameter | Value | Notes |
|-----------|-------|-------|
| `wsFailuresBeforeModbus` | 3 | ~9 s before Modbus fallback |
| `modbusFailuresBeforeSim` | 5 | ~1.25 s before client sim |
| `wsReconnectMs` | 3 000 ms | WS retry interval |
| `modbusPollingMs` | 250 ms | Modbus poll interval |
| `simIntervalMs` | 100 ms | Client sim interval |
| `maxDisplayLatencyMs` | 9 999 ms | Clock-skew cap |

---

## 4. Phase 10 — Connection Architecture (2026-06-04)

### What Was Added

#### Rust (src-tauri/src/)
| File | Purpose |
|------|---------|
| `modbus_reader.rs` | Raw Modbus TCP FC4 reader (no external crates — uses tokio TcpStream). Reads 4 input registers, decodes two ABCD/Big-Endian Float32 values |
| `commands.rs` | Added `read_modbus_tcp(host, port, slave_id)` command |
| `main.rs` | Registered new command |

#### TypeScript Services (src/services/)
| File | Purpose |
|------|---------|
| `device/ConnectionTypes.ts` | `DataProtocol` type, `ConnectionHealth` interface, `FALLBACK_CONFIG` constants |
| `device/DeviceIdentity.ts` | Device identity types, `DEFAULT_MACHINE_ID = "RAV-01"`, identity validation helpers |
| `device/ConnectionManager.ts` | **Orchestrator**: WS → Modbus → Client-Sim fallback chain. Pure TS class, no React dependency |
| `websocket/WebSocketService.ts` | Standalone WS client with latency measurement (server timestamp delta) and auto-reconnect |
| `modbus/ModbusTcpService.ts` | Polls `read_modbus_tcp` Tauri command at 250 ms intervals |
| `discovery/DeviceDiscoveryService.ts` | Thin facade over Tauri discovery commands |
| `health/HealthMonitor.ts` | Tracks data staleness, rolling readings/sec, latency |

#### Updated TypeScript Files
| File | Change |
|------|--------|
| `services/tauriCommands.ts` | Added `readModbusTcp(host, port, slaveId)` wrapper |
| `types/tauri.ts` | Added `ModbusSensorReading` interface |
| `store/sensorStore.ts` | Added `latencyMs: number`, `activeDataProtocol: DataProtocol`, `setActiveProtocol()` |
| `hooks/useConnectionManager.ts` | **New hook** — React bridge for `ConnectionManager`. Replaces `useWebSocket` in MainLayout |
| `components/layout/MainLayout.tsx` | Calls `useConnectionManager()` instead of `useWebSocket()` |
| `components/panels/StatusPanel.tsx` | Shows: Status, Protocol badge, Device name, **Machine ID (RAV-01)**, **IP**, **Latency**, Last Update, Data Points, Reconnects, Session Up, System Up, Mode |
| `components/layout/TopBar.tsx` | DeviceInfo strip now shows: Name · IP · **Protocol badge** · **Latency (ms)** |

### Connection Priority Flow

```
ULTRON.exe launches
        ↓
SplashPage: Start backend → Auto-discover Pi
        ↓
If Pi found:
  Set connectionStore.config (wsUrl, deviceIp, modbusPort)
  Navigate → MainLayout
        ↓
useConnectionManager starts ConnectionManager:
  [1] WebSocket ws://<Pi-IP>:8000/ws   ← PRIMARY
         ↓ (5 consecutive failures)
  [2] Modbus TCP <Pi-IP>:5020, FC4     ← FALLBACK
         ↓ (5 consecutive failures)
  [3] Client-side simulation            ← LAST RESORT
         (always reconnecting WS in background)
        ↓
If Pi not found OR protocol = 'simulation':
  WebSocket → ws://localhost:8000/ws (local backend)
         ↓ (5 failures)
  Client-side simulation (skip Modbus — no Pi IP)
```

### Fallback Thresholds (FALLBACK_CONFIG)
| Setting | Value |
|---------|-------|
| `wsFailuresBeforeModbus` | 5 consecutive WS errors |
| `modbusFailuresBeforeSim` | 5 consecutive Modbus errors |
| `wsReconnectMs` | 3 000 ms |
| `modbusPollingMs` | 250 ms |
| `simIntervalMs` | 100 ms |
| `maxDisplayLatencyMs` | 9 999 ms (clock-skew cap) |

### Latency Measurement
Latency is computed as: `Date.now() - new Date(reading.timestamp).getTime()`

The server (Pi backend) timestamps every WebSocket frame. On a LAN where clocks are NTP-synced, this gives a reliable estimate. Displayed in:
- **TopBar** (right of protocol badge) — color-coded: green <50 ms, amber <200 ms, red ≥200 ms
- **StatusPanel** (Latency row) — same color coding

---

## 4. Blocking Issues

| # | Issue | File | Fix |
|---|-------|------|-----|
| 1 | ~~`HardwarePressureSensor.read()` raises `NotImplementedError`~~ | ✅ Fixed — ADS1115 I2C driver implemented | — |
| 2 | `allow_origins=["*"]` — unsafe for production | `ultron-backend/app/main.py:157` | Restrict to `tauri://localhost` |
| 3 | Backend path resolution in Tauri unverified on real machine | `ultron-desktop/src-tauri/src/backend_manager.rs` | Test production build |

---

## 5. Active Files

### Backend (Python)
| File | What It Does |
|------|-------------|
| `ultron-backend/app/main.py` | FastAPI app entry — all endpoints + WebSocket + lifespan |
| `ultron-backend/app/sensor_manager.py` | Simulated + hardware sensor classes |
| `ultron-backend/app/modbus/register_map.py` | All Modbus register constants |
| `ultron-backend/app/config.py` | All settings (from `.env`) |

### Frontend (TypeScript/React)
| File | What It Does |
|------|-------------|
| `ultron-desktop/src/pages/DashboardPage.tsx` | Main dashboard — fixed-viewport layout |
| `ultron-desktop/src/components/panels/ProcessOverview.tsx` | Digital twin panel + fullscreen |
| `ultron-desktop/src/components/process/RotaryAirlockValveSvg.tsx` | SVG machine diagram |
| `ultron-desktop/src/components/charts/MultiTrendChart.tsx` | Dual-axis trend chart |
| `ultron-desktop/src/components/process/sensorPoints.ts` | 11 sensor metadata + live data merge |
| `ultron-desktop/src/config/constants.ts` | Alarm thresholds + chart constants |
| `ultron-desktop/src/store/sensorStore.ts` | Zustand: readings, health, alarms, latencyMs, activeDataProtocol |
| `ultron-desktop/src/index.css` | CSS variables — navy-steel palette |

### Connection Layer (Phase 10 + 12 additions)
| File | What It Does |
|------|-------------|
| `ultron-desktop/src/hooks/useConnectionManager.ts` | React hook — mounts/tears down ConnectionManager |
| `ultron-desktop/src/services/device/ConnectionManager.ts` | WS → Modbus → Sim orchestrator; WS recovery bug fixed Phase 12 |
| `ultron-desktop/src/services/websocket/WebSocketService.ts` | WebSocket client with latency + reconnect |
| `ultron-desktop/src/services/modbus/ModbusTcpService.ts` | Modbus TCP polling via Tauri command |
| `ultron-desktop/src/services/device/ConnectionTypes.ts` | DataProtocol type + FALLBACK_CONFIG |
| `ultron-desktop/src/services/device/DeviceIdentity.ts` | Device identity types, DEFAULT_MACHINE_ID = "RAV-01" |
| `ultron-desktop/src/services/discovery/DeviceDiscoveryService.ts` | Discovery facade over Tauri |
| `ultron-desktop/src/services/health/HealthMonitor.ts` | Connection quality metrics |
| `ultron-desktop/src/store/connectionStore.ts` | ConnectionConfig with machineId field |
| `ultron-desktop/src/types/tauri.ts` | TauriDeviceInfo with optional machine_id + serial_number |
| `ultron-desktop/src-tauri/src/device_discovery.rs` | 3-tier discovery: last-known → mDNS → subnet (local-detected) |
| `ultron-desktop/src-tauri/src/modbus_reader.rs` | Raw Modbus TCP FC4 sensor reader (Rust) |
| `ultron-desktop/src-tauri/src/commands.rs` | All Tauri commands incl. get_local_ip |

---

## 6. Commands

### Backend (development)

```powershell
cd "e:\Oswar Software\ULTRON\ULTRON PHASE 1 DEMO\ULTRON Phase 1\ultron-backend"
.venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Desktop app (development)

```powershell
cd "e:\Oswar Software\ULTRON\ULTRON PHASE 1 DEMO\ultron-desktop"
npm run tauri dev
```

### TypeScript check

```powershell
cd "e:\Oswar Software\ULTRON\ULTRON PHASE 1 DEMO\ultron-desktop"
npm run type-check
```

### Rust check

```powershell
cd "e:\Oswar Software\ULTRON\ULTRON PHASE 1 DEMO\ultron-desktop\src-tauri"
cargo check
```

### Production build

```powershell
cd "e:\Oswar Software\ULTRON\ULTRON PHASE 1 DEMO\ultron-desktop"
npm run tauri build
```

### Quick Modbus TCP test (Python)

```powershell
python -c "from pymodbus.client import ModbusTcpClient; c=ModbusTcpClient('localhost',port=5020); c.connect(); r=c.read_input_registers(0,4); print(r.registers); c.close()"
```

### Quick Modbus TCP test (Tauri invoke, dev console)

```javascript
// In the Tauri dev window's browser console:
window.__TAURI__.core.invoke('read_modbus_tcp', { host: '192.168.1.14', port: 5020, slaveId: 1 })
  .then(console.log)
  .catch(console.error);
```

### Get local IP (Tauri invoke, dev console)

```javascript
window.__TAURI__.core.invoke('get_local_ip').then(console.log);
// → "192.168.10.5"  (or whatever the machine's LAN IP is)
```

### Probe a specific Pi IP directly (Tauri invoke, dev console)

```javascript
window.__TAURI__.core.invoke('connect_device', { apiBase: 'http://192.168.10.10:8000' })
  .then(console.log)
  .catch(console.error);
// → { device_name: "ULTRON Edge", machine_id: "RAV-01", api_base: "http://192.168.10.10:8000", ... }
```

### Verify backend identity response (curl / browser)

```bash
curl http://192.168.10.10:8000/api/device/identity
# Expected: { "device_name": "ULTRON Edge", "machine_id": "RAV-01", "api_port": 8000, ... }
```

---

## 7. Key Configuration Defaults

```ini
# ultron-backend/.env  (current — SIMULATED=false is the default since Phase 13)
APP_NAME=ULTRON
APP_VERSION=1.0.0
DEVICE_ID=RPi4-ULTRON-001
MACHINE_ID=RAV-01                 # Monitored machine — shown in dashboard StatusPanel

SIMULATED=false                   # Hardware mode default (graceful fallback to sim if sensors absent)
HOST=0.0.0.0
PORT=8000
BROADCAST_INTERVAL_MS=100         # WebSocket update rate (10 Hz)

PRESSURE_SENSOR_RANGE_BAR=10.0    # Physical transmitter full-scale
PRESSURE_ADS1115_CHANNEL=0        # AIN0
PRESSURE_ADS1115_ADDRESS=0x48     # Default I2C address (ADDR→GND)

MODBUS_TCP_ENABLED=true
MODBUS_TCP_PORT=5020              # 502 for production (needs root on Linux)
MODBUS_RTU_ENABLED=false
MODBUS_RTU_PORT=/dev/ttyUSB0
MODBUS_BYTE_ORDER=ABCD            # Float32 big-endian word order
MDNS_ENABLED=true
MDNS_HOSTNAME=ultron-edge
```

> **pymodbus version lock:** `requirements.txt` pins `pymodbus>=3.6.0,<3.7.0`.
> Do NOT upgrade to 3.7+ without testing — pymodbus 3.7–3.13 changed the datastore
> API in a breaking way (ModbusSlaveContext renamed, ModbusSequentialDataBlock address 0 banned).

---

## 8. Next Steps (Priority Order)

1. **Wire the 24VDC loop supply for the P1 pressure transmitter**
   - Connect: `24VDC PSU (+)` → transmitter `(+)` → transmitter `(–)` → `250Ω shunt` → ADS1115 `AIN0` → `24VDC PSU (–)` (GND)
   - See HARDWARE.md §5.P1 wiring diagram
   - Expected result: pressure gauge shows real process pressure (6–8 bar operating range)
   - Verify with a reference gauge — ADS1115 is already reading correctly, just needs loop power

2. **Wire the DS18B20 temperature sensor (MT2)**
   - Connect: DS18B20 `DQ` → RPi GPIO 27 (Pin 13) with `4.7kΩ pull-up to 3.3V` (Pin 1)
   - Enable 1-Wire on Pi: `sudo raspi-config → Interfaces → 1-Wire → Enable` then reboot
   - Expected result: temperature gauge shows real temperature; "NO SENSOR" badge disappears
   - See HARDWARE.md §5.MT2

3. **Test Modbus fallback**
   - With Pi WS running, confirm dashboard shows WS badge
   - Stop only the FastAPI process on Pi (`Ctrl+C` in the uvicorn terminal)
   - After ~9 s, dashboard badge should change from WS → MODBUS (port 5020 still running)
   - Restart FastAPI; badge should return to WS within 3 s

4. **Test production build — `.exe` on clean Windows machine**
   - `npm run tauri build` in `ultron-desktop/`
   - Install on a clean machine (no Node, no Python pre-installed)
   - Launch ULTRON.exe — SplashPage should auto-discover Pi at 192.168.1.14
   - Verify live readings appear without any manual configuration

5. **Restrict CORS for production**
   - `ultron-backend/app/main.py` line ~157 — change `allow_origins=["*"]` to `["tauri://localhost"]`

6. **Plan Phase 2 sensors** — BT1, BT2 (bearing temps), RPM1, M1 (motor current)

---

## 9. Open Questions

| Question | Status |
|----------|--------|
| ADC board confirmed? (ADS1115 assumed) | ✅ Confirmed — ADS1115 at 0x48, I2C, reading AIN0 |
| Static IP assigned to Raspberry Pi? | ✅ Yes — `192.168.1.14` (confirmed by dashboard connection) |
| 24VDC loop supply wired for P1 transmitter? | ❌ Not yet — pressure reads ~0 bar (minimum 4mA loop current only) |
| DS18B20 temperature sensor wired? | ❌ Not yet — dashboard shows "NO SENSOR" |
| Production Modbus port: 502 or 5020? | Using 5020 (dev); 502 requires root on Linux |
| Target deployment screen resolution? | Unknown |
| Database strategy for Phase 2? (SQLite / InfluxDB) | Unknown — see [DATABASE.md](DATABASE.md) |
| Tauri installer format: NSIS or MSI? | Unknown |
| Clock sync between Pi and laptop? | NTP recommended for accurate latency display |
| Pi backend auto-start on boot? | Not configured — manual start only; consider `systemd` service for production |
