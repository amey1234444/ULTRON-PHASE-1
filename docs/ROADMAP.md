# ROADMAP.md
## ULTRON — Product Roadmap

**Purpose:** Document the planned development phases for ULTRON, from Phase 1 MVP through Phase 5 cloud platform.
**Last Updated:** 2026-06-02
**Audience:** Product team, engineers, management, investors

> Cross-references: [HARDWARE.md](HARDWARE.md) | [SOFTWARE.md](SOFTWARE.md) | [DECISIONS.md](DECISIONS.md) | [MACHINES.md](MACHINES.md)

---

## Roadmap Overview

```mermaid
gantt
    title ULTRON Development Roadmap
    dateFormat YYYY-QQ
    
    section Phase 1 — MVP
    Rotary Airlock Valve        :done, 2025-Q3, 2026-Q2
    Pressure + Temperature      :done, 2025-Q3, 2026-Q2
    WebSocket + Modbus TCP      :done, 2025-Q3, 2026-Q2
    Tauri Desktop App           :done, 2025-Q3, 2026-Q2
    Digital Twin SVG            :done, 2026-Q1, 2026-Q2
    
    section Phase 2 — Machine Health
    Bearing Temps (BT1, BT2)    :2026-Q3, 2026-Q4
    Rotor Speed (RPM1)          :2026-Q3, 2026-Q4
    Motor Current (M1)          :2026-Q3, 2026-Q4
    SQLite Persistence          :2026-Q3, 2026-Q4
    
    section Phase 3 — Predictive
    Vibration (V1, V2)          :2027-Q1, 2027-Q2
    FFT Analysis                :2027-Q1, 2027-Q2
    Machine Health Score        :2027-Q1, 2027-Q2
    
    section Phase 4 — Hardware Platform
    UM Card / TP Card           :2027-Q3, 2027-Q4
    Gateway Architecture        :2027-Q3, 2027-Q4
    Multi-machine Support       :2027-Q3, 2027-Q4
    
    section Phase 5 — Cloud
    Cloud Backend               :2028-Q1, 2028-Q2
    Fleet Monitoring            :2028-Q1, 2028-Q3
```

---

## Phase 1 — Minimum Viable Product

**Status:** ✅ Complete (Phase 9 done)
**Goal:** Investor-ready demo — monitor one machine type, deliver to desktop app

### Sensors

| Tag | Parameter | Status |
|-----|-----------|--------|
| P1 | Inlet Pressure | ✅ Active (simulated) |
| MT2 | Outlet Material Temperature | ✅ Active (simulated) |

### Features

| Feature | Status |
|---------|--------|
| FastAPI backend + Uvicorn | ✅ Complete |
| WebSocket stream (10 Hz) | ✅ Complete |
| Modbus TCP server (port 5020) | ✅ Complete |
| Modbus RTU server | ✅ Implemented (untested) |
| mDNS auto-discovery | ✅ Complete |
| Simulated sensor data | ✅ Complete |
| Tauri 2.x desktop shell | ✅ Complete |
| ECharts pressure gauge | ✅ Complete |
| ECharts temperature gauge | ✅ Complete |
| Health score donut gauge | ✅ Complete |
| Dual-axis trend chart | ✅ Complete |
| Alarm panel with ACK | ✅ Complete |
| Rotary Airlock Valve digital twin | ✅ Complete (11 sensor points) |
| Click-to-fullscreen digital twin | ✅ Complete |
| Fixed-viewport dashboard | ✅ Complete |
| Navy-steel dark theme (Option 3) | ✅ Complete — Locked |
| Device auto-discovery flow | ✅ Complete |
| Settings persistence | ✅ Complete |
| Monitoring page (CPU/RAM/connection) | ✅ Complete |

### Remaining Phase 1 Work

| Item | Status |
|------|--------|
| Hardware ADS1115 driver for P1 | ❌ NotImplementedError — blocked |
| Production build test | ❌ Not verified |
| CORS restriction | ❌ allow_origins=["*"] |
| Hardware deployment on Raspberry Pi | ❌ Not yet |

---

## Phase 2 — Enhanced Machine Health Monitoring

**Status:** Not started
**Goal:** Real mechanical health monitoring — bearing temps, rotor speed, motor current

### New Sensors

| Tag | Parameter | Technology | Priority |
|-----|-----------|-----------|---------|
| BT1 | Drive-Side Bearing Temperature | PT100 RTD + 4–20 mA | High |
| BT2 | NDS Bearing Temperature | PT100 RTD + 4–20 mA | High |
| RPM1 | Rotor Speed | Inductive proximity + GPIO pulse | High |
| ZS1 | Zero-Speed Detection | Zero-speed switch | High |
| M1 | Motor Current | CT + 4–20 mA transmitter | Medium |
| P2 | Outlet Pressure | 4–20 mA pressure transmitter | Medium |

### Software Features

| Feature | Description |
|---------|-------------|
| SQLite data persistence | Store readings, alarms, events |
| Historical data API | `GET /api/sensors/history` |
| Alarm history log | Persistent alarm records |
| Bearing temperature gauges | BT1, BT2 cards in dashboard |
| RPM gauge | Rotor speed card |
| Motor current gauge | M1 card |
| Zero-speed alarm | Critical alarm when ZS1 triggers |
| Extended health score | Incorporate bearing temp + RPM into score |
| Export to CSV | `GET /api/sensors/export` |

### Hardware Requirements

See [HARDWARE.md § 12](HARDWARE.md#12-future-expansion-roadmap) for Phase 2 hardware.

### Modbus Registers

New registers to be added:
- 30013–30014: BT1 Drive Bearing Temp (Float32, °C)
- 30015–30016: BT2 NDS Bearing Temp (Float32, °C)
- 30017–30018: RPM1 Rotor Speed (Float32, rpm)
- 30019: ZS1 Zero Speed (UInt16, 0/1)
- 30020–30021: M1 Motor Current (Float32, A)
- 30022–30023: P2 Outlet Pressure (Float32, bar)

---

## Phase 3 — Predictive Maintenance

**Status:** Not started
**Goal:** Vibration analysis, FFT, machine health scoring, maintenance scheduling

### New Sensors

| Tag | Parameter | Technology |
|-----|-----------|-----------|
| V1 | Drive-Side Vibration RMS | 4–20 mA vibration transmitter |
| V2 | NDS Vibration RMS | 4–20 mA vibration transmitter |

### Software Features

| Feature | Description |
|---------|-------------|
| Vibration RMS gauges | V1, V2 cards in dashboard |
| FFT spectrum analysis | Raspberry Pi FFT from IEPE accelerometer |
| Bearing fault detection | BPFI, BPFO, BSF, FTF frequency analysis |
| Machine Health Score V2 | Multi-sensor weighted health algorithm |
| Trend extrapolation | Predict when bearing will reach threshold |
| Maintenance scheduler | Alert N days before predicted failure |
| Vibration baseline learning | Establish "normal" vibration fingerprint |
| InfluxDB storage | Time-series database for long-term trends |
| Analytics API | Statistical summaries, trend data |

---

## Phase 4 — Hardware Platform Expansion

**Status:** Not started
**Goal:** Support dedicated measurement hardware, multi-machine architecture

### New Hardware Modules

| Module | Purpose |
|--------|---------|
| UM Card (Universal Measurement) | 8-channel 24-bit ADC with signal conditioning |
| TP Card (Temperature & Process) | RTD/thermocouple input card |
| Wireless Sensor Node | Battery-powered IoT sensor node |
| Industrial Gateway | Dedicated gateway device (not Raspberry Pi) |

### New Machine Types

First expansion machine (Unknown / needs verification — depends on customer need):
- Kiln
- Conveyor
- Compressor
- Fan / Blower

### Software Features

| Feature | Description |
|---------|-------------|
| Multi-machine dashboard | View multiple machines simultaneously |
| Machine selector | Switch between monitored machines |
| Gateway device support | Connect UM Card / TP Card via Modbus RTU |
| Device type codes | Modbus register 30214 extended |
| Machine configuration | Define machine type, sensors, thresholds via UI |
| Alarm routing | Different alarm contacts per machine |

---

## Phase 5 — Cloud Platform

**Status:** Not started
**Goal:** Fleet monitoring, remote access, analytics, cloud dashboard

### Cloud Architecture

| Component | Description |
|-----------|-------------|
| ULTRON Cloud API | REST + WebSocket cloud backend |
| Time-Series Database | InfluxDB Cloud or TimescaleDB |
| MQTT Broker | AWS IoT Core or HiveMQ |
| Analytics Engine | Anomaly detection, trend analysis |
| Alert Service | Email / SMS / webhook notifications |
| Web Dashboard | Browser-based ULTRON Web |

### Features

| Feature | Description |
|---------|-------------|
| Secure cloud uplink | MQTT over TLS from gateway to cloud |
| Fleet overview | All machines across all sites |
| Remote dashboard | Access from anywhere (ULTRON Web, mobile) |
| Cloud analytics | Long-term trend analysis, ML anomaly detection |
| Multi-user support | Different roles and permissions |
| API key authentication | Secure API access |
| Alerting | Configurable email/SMS/webhook notifications |
| Offline resilience | Edge buffers data when cloud disconnected |
| Report generation | Automated PDF / Excel maintenance reports |

---

## What Is NOT in Scope

| Item | Reason |
|------|--------|
| Real-time process control (PLC replacement) | ULTRON is monitoring only — never control |
| Safety interlocking | ULTRON alarms are advisory — physical interlocks are separate |
| Closed-loop control | Out of scope for ULTRON platform |
| Video surveillance | Out of scope |
| Voice alerts | Unknown / future consideration |

---

## Decision Log for Roadmap

See [DECISIONS.md](DECISIONS.md) for all major roadmap and architectural decisions.
