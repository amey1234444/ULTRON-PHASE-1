# SYSTEM_ARCHITECTURE.md
## ULTRON — System Architecture Reference

**Purpose:** High-level system design for all audiences — engineers, managers, interns.
**Last Updated:** 2026-06-02
**Audience:** Everyone

> Cross-references: [SOFTWARE.md](SOFTWARE.md) | [HARDWARE.md](HARDWARE.md) | [PROTOCOLS.md](PROTOCOLS.md) | [MODBUS.md](MODBUS.md)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1 MVP Architecture](#2-phase-1-mvp-architecture)
3. [Component Descriptions](#3-component-descriptions)
4. [Data Flow](#4-data-flow)
5. [Device Discovery Flow](#5-device-discovery-flow)
6. [Alarm Flow](#6-alarm-flow)
7. [Connection State Machine](#7-connection-state-machine)
8. [Future Edge Architecture](#8-future-edge-architecture)
9. [Future Gateway Architecture](#9-future-gateway-architecture)
10. [Future Multi-Machine Architecture](#10-future-multi-machine-architecture)
11. [Future Cloud Architecture](#11-future-cloud-architecture)
12. [Protocol Stack](#12-protocol-stack)

---

## 1. Architecture Overview

ULTRON is an **Industrial Machine Monitoring Platform** with three tiers:

```
┌─────────────────────────────────────────────────────────────┐
│ TIER 1 — FIELD                                              │
│  Physical sensors on the machine                           │
│  (pressure transmitters, temperature sensors, etc.)        │
└──────────────────────┬──────────────────────────────────────┘
                       │ 4–20 mA / 1-Wire / RS485
┌──────────────────────▼──────────────────────────────────────┐
│ TIER 2 — EDGE                                               │
│  Raspberry Pi 4 running ULTRON Backend                     │
│  Reads sensors → serves WebSocket + Modbus TCP/RTU         │
└──────────┬──────────────────────────┬───────────────────────┘
           │ WebSocket / Modbus TCP   │ mDNS advertisement
┌──────────▼──────────────────────────▼───────────────────────┐
│ TIER 3 — PRESENTATION                                       │
│  ULTRON Desktop App (Tauri + React)                        │
│  Live gauges, trends, alarms, digital twin                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1 MVP Architecture

```mermaid
graph TB
    subgraph Field["FIELD — Rotary Airlock Valve"]
        P1["P1 — Inlet Pressure\n4–20 mA transmitter"]
        MT2["MT2 — Outlet Temperature\n1-Wire DS18B20"]
    end

    subgraph Edge["EDGE — Raspberry Pi 4"]
        ADC["ADS1115 ADC\n(I2C)"]
        GPIO27["GPIO 27\n(1-Wire)"]
        SM["SensorManager\n(simulated / hardware)"]
        FA["FastAPI + Uvicorn\nport 8000"]
        WS["WebSocketManager\nbroadcast 100ms"]
        MB["ModbusService\nTCP port 5020"]
        MDNS["mDNS Advertiser\n_ultron._tcp.local."]
    end

    subgraph Desktop["DESKTOP — Windows PC"]
        DISC["Device Discovery\n(mDNS + subnet scan)"]
        HOOK["useWebSocket hook\nauto-reconnect"]
        STORE["Zustand Stores\nsensor / connection / app"]
        DASH["Dashboard\nGauges + Charts + Twin"]
        ALARMS["Alarm System"]
    end

    P1 -->|"4–20 mA"| ADC
    MT2 -->|"1-Wire digital"| GPIO27
    ADC --> SM
    GPIO27 --> SM
    SM -->|"100ms loop"| WS
    SM -->|"100ms loop"| MB
    FA --> WS
    FA --> MB
    FA --> MDNS
    MDNS -->|"UDP multicast"| DISC
    WS -->|"ws://host:8000/ws"| HOOK
    HOOK --> STORE
    STORE --> DASH
    STORE --> ALARMS
```

### Current Implementation Notes

- Both sensors currently in **simulation mode** — hardware drivers are stubs
- Modbus RTU server is implemented but not tested on physical RS485 hardware
- mDNS advertisement works — desktop auto-discovers the Raspberry Pi

---

## 3. Component Descriptions

| Component | Technology | Location | Responsibility |
|-----------|-----------|----------|---------------|
| **SensorManager** | Python | `ultron-backend/app/sensor_manager.py` | Reads P1 and MT2 every 100 ms; selects simulated or hardware sensor |
| **FastAPI App** | Python | `ultron-backend/app/main.py` | REST API + WebSocket endpoint; application lifespan management |
| **WebSocketManager** | Python | `ultron-backend/app/websocket_manager.py` | Connection registry; broadcasts SensorReading to all connected clients |
| **ModbusService** | Python | `ultron-backend/app/modbus/modbus_service.py` | Runs Modbus TCP/RTU servers; updates Input Registers on each sensor read |
| **MDNSAdvertiser** | Python | `ultron-backend/app/discovery/mdns_advertiser.py` | Advertises ULTRON device on LAN via Zeroconf |
| **Tauri Shell** | Rust | `ultron-desktop/src-tauri/` | Native window; spawns Python backend; Tauri commands bridge |
| **React App** | TypeScript | `ultron-desktop/src/` | UI dashboard; state management; WebSocket client |
| **useWebSocket** | TypeScript | `ultron-desktop/src/hooks/useWebSocket.ts` | WebSocket connection management; auto-reconnect; feeds sensorStore |
| **sensorStore** | TypeScript | `ultron-desktop/src/store/sensorStore.ts` | Readings ring buffer; health score; alarm evaluation |
| **DashboardPage** | TypeScript | `ultron-desktop/src/pages/DashboardPage.tsx` | Fixed-viewport layout: gauges + digital twin + trend chart |
| **RotaryAirlockValveSvg** | TypeScript/SVG | `ultron-desktop/src/components/process/RotaryAirlockValveSvg.tsx` | Inline SVG digital twin with 11 sensor dot overlays |

---

## 4. Data Flow

### Sensor Reading → Dashboard (End-to-End)

```mermaid
sequenceDiagram
    participant HW as Hardware Sensor
    participant SM as SensorManager
    participant WS as WebSocketManager
    participant MB as ModbusService
    participant CLI as Tauri Desktop App
    participant ST as Zustand sensorStore
    participant UI as React Dashboard

    loop Every 100ms
        SM->>HW: read() [asyncio.gather P1 + MT2]
        HW-->>SM: pressure=7.35, temperature=82.1
        SM->>SM: _derive_status() → "healthy"
        SM->>WS: broadcast(SensorReading)
        SM->>MB: update_registers(SensorReading)
        WS->>CLI: JSON over WebSocket
        CLI->>ST: addReading(reading)
        ST->>ST: compute healthScore, evaluate alarms
        ST->>UI: React subscription re-render
    end
```

### WebSocket Message Format

```json
{
  "timestamp": "2026-06-02T10:00:00+00:00",
  "pressure":  7.35,
  "temperature": 82.1,
  "status": "healthy"
}
```

Status values: `healthy` | `warning` | `critical` | `offline`

---

## 5. Device Discovery Flow

```mermaid
flowchart TD
    START([App Starts]) --> CHECK{Known device\nin config?}
    CHECK -->|Yes| PROBE[Probe last known IP\nGET /api/device/identity]
    CHECK -->|No| DISC[Start Discovery]
    PROBE -->|200 OK| CONNECT[Connect WebSocket]
    PROBE -->|Timeout / Error| DISC
    DISC --> MDNS[mDNS scan\n_ultron._tcp.local.]
    DISC --> SUBNET[Subnet scan\nGET /api/device/identity]
    MDNS --> FOUND{Device found?}
    SUBNET --> FOUND
    FOUND -->|Yes| SHOW[Show device list\nDiscoveryScreen]
    FOUND -->|No, timeout 10s| SIM[Enter Simulation Mode\nuse localhost backend]
    SHOW --> SEL[User selects device]
    SEL --> SAVE[Save IP to config]
    SAVE --> CONNECT
    CONNECT --> DASH[Dashboard — live data]
    SIM --> DASH
```

### Discovery Protocols (in priority order)

1. **Cached last-known IP** — fastest; checked first
2. **mDNS** — `_ultron._tcp.local.` — finds device if on same LAN segment
3. **Subnet scan** — tries common IPs; slower but reliable
4. **Modbus TCP probe** — checks if Modbus device responds at port 5020
5. **Simulation mode** — fallback when no device found

---

## 6. Alarm Flow

```mermaid
flowchart LR
    READ[SensorReading\narrives] --> EVAL{Evaluate\nthresholds}
    EVAL -->|pressure ≥ 10.45 or\ntemp ≥ 109.25| CRIT[status = critical\nRed indicator]
    EVAL -->|pressure ≥ 8.8 or\ntemp ≥ 92.0| WARN[status = warning\nYellow indicator]
    EVAL -->|all within range| OK[status = healthy\nGreen indicator]
    CRIT --> STORE[sensorStore\nalarms updated]
    WARN --> STORE
    OK --> STORE
    STORE --> GAUGE[Gauge color\nchanges]
    STORE --> TOPBAR[TopBar alarm badge\nupdated]
    STORE --> ALARM_PANEL[AlarmPanel\nrow appears]
    ALARM_PANEL --> ACK[Operator presses ACK\nalarm acknowledged]
```

### Alarm Thresholds (Frontend — `constants.ts`)

| Parameter | Warning | Critical |
|-----------|---------|----------|
| Pressure | ≥ 8.8 bar | ≥ 10.45 bar |
| Temperature | ≥ 92.0 °C | ≥ 109.25 °C |

### Visual Alarm Indicators

| Location | Normal | Warning | Critical |
|----------|--------|---------|----------|
| Gauge color | `--ok` (#20D068 green) | `--warn` (#FFB020 amber) | `--crit` (#FF4040 red) |
| TopBar badge | Hidden | Amber count | Red count |
| AlarmPanel | Empty | Row with yellow tag | Row with red tag |
| Sensor dot (SVG) | Green | Amber | Red |
| Machine SVG glow | None | Yellow | Red |

---

## 7. Connection State Machine

```mermaid
stateDiagram-v2
    [*] --> Splash
    Splash --> Discovery: no known device
    Splash --> Connecting: known device found
    Discovery --> Connecting: device selected
    Discovery --> Simulation: no device found (timeout)
    Connecting --> Connected: WebSocket handshake OK
    Connecting --> Disconnected: connection failed
    Connected --> Disconnected: WebSocket closed
    Disconnected --> Connecting: auto-reconnect (3s delay)
    Disconnected --> Simulation: reconnect count > limit
    Simulation --> Connecting: user manually connects
    Connected --> Settings: user opens settings
    Settings --> Connected: user closes settings
```

---

## 8. Future Edge Architecture

Phase 4 — support for dedicated measurement cards:

```mermaid
graph TB
    subgraph Field["FIELD"]
        PRESS["Pressure Sensors\n4–20 mA"]
        TEMP["Temperature Sensors\nRTD / TC"]
        VIB["Vibration Sensors\nIEPE"]
        RPM["Speed Sensors\nProximity"]
    end

    subgraph UM["UM CARD (Universal Measurement)"]
        ADC8["8-channel\n24-bit ADC"]
        ISO["Electrical\nIsolation"]
    end

    subgraph TP["TP CARD (Temperature & Process)"]
        RTD["RTD/TC\nInterface"]
    end

    subgraph GW["GATEWAY (Raspberry Pi / Industrial PC)"]
        MODBUS_RTU["Modbus RTU\nRS485"]
        BACKEND["ULTRON Backend"]
    end

    PRESS --> UM
    VIB --> UM
    TEMP --> TP
    RPM --> UM
    UM -->|"RS485 Modbus RTU"| MODBUS_RTU
    TP -->|"RS485 Modbus RTU"| MODBUS_RTU
    MODBUS_RTU --> BACKEND
    BACKEND -->|"WebSocket / Modbus TCP"| Desktop["ULTRON Desktop"]
```

---

## 9. Future Gateway Architecture

Phase 4 — multiple machines, one gateway:

```mermaid
graph TB
    subgraph Site["PLANT SITE"]
        RAV["Rotary Airlock Valve\nSlave ID: 1"]
        KILN["Kiln\nSlave ID: 2"]
        CONV["Conveyor\nSlave ID: 3"]
    end

    subgraph GW["ULTRON GATEWAY"]
        POLLER["Modbus RTU Poller\n(polls each slave)"]
        ROUTER["Message Router\n(tag → machine mapping)"]
        WS_SRV["WebSocket Server\n(multi-machine streams)"]
        MB_TCP["Modbus TCP Server\n(aggregated registers)"]
    end

    subgraph Desktop["DESKTOP / SCADA"]
        ULTRA["ULTRON Desktop\n(multi-machine view)"]
        SCADA_SYS["External SCADA\n(Ignition / WonderWare)"]
    end

    RAV -->|"RS485 Modbus RTU"| POLLER
    KILN -->|"RS485 Modbus RTU"| POLLER
    CONV -->|"RS485 Modbus RTU"| POLLER
    POLLER --> ROUTER
    ROUTER --> WS_SRV
    ROUTER --> MB_TCP
    WS_SRV --> ULTRA
    MB_TCP --> SCADA_SYS
```

---

## 10. Future Multi-Machine Architecture

Phase 5:

```mermaid
graph LR
    subgraph Machines["MACHINES"]
        RAV["RAV-01"]
        KILN["KILN-01"]
        COMP["COMP-01"]
    end

    subgraph Gateways["GATEWAYS"]
        GW1["Gateway 1\n(North Wing)"]
        GW2["Gateway 2\n(South Wing)"]
    end

    subgraph Cloud["CLOUD"]
        API_GW["ULTRON Cloud API"]
        DB["Time-Series DB\n(InfluxDB / TimescaleDB)"]
        ANALYTICS["Analytics Engine"]
        ALERTS["Alert Service"]
    end

    subgraph Clients["CLIENTS"]
        DESKTOP["ULTRON Desktop"]
        WEB["ULTRON Web"]
        MOBILE["ULTRON Mobile"]
    end

    RAV --> GW1
    KILN --> GW1
    COMP --> GW2
    GW1 -->|"MQTT / WebSocket"| API_GW
    GW2 -->|"MQTT / WebSocket"| API_GW
    API_GW --> DB
    DB --> ANALYTICS
    ANALYTICS --> ALERTS
    API_GW --> DESKTOP
    API_GW --> WEB
    API_GW --> MOBILE
```

---

## 11. Future Cloud Architecture

Phase 5:

```mermaid
graph TB
    GW["ULTRON Gateway\n(on-premise)"] -->|"Secure MQTT TLS"| BROKER["MQTT Broker\n(cloud)"]
    BROKER --> INGEST["Ingestion Service"]
    INGEST --> TSDB["Time-Series DB\nInfluxDB / TimescaleDB"]
    TSDB --> DASH_SVC["Dashboard Service"]
    TSDB --> ML["ML / Anomaly Detection"]
    ML --> ALERT_SVC["Alert Service"]
    ALERT_SVC -->|"Email / SMS / Webhook"| OPS["Operations Team"]
    DASH_SVC --> WEB_APP["ULTRON Web App"]
    DASH_SVC --> MOBILE_APP["ULTRON Mobile"]
```

---

## 12. Protocol Stack

| Layer | Protocol | Current | Future |
|-------|---------|---------|--------|
| Sensor → Edge | 4–20 mA (analog), 1-Wire, RS485 | ✅ Phase 1 | Wireless sensors (Phase 4) |
| Edge internal | I2C (ADC), GPIO | ✅ Phase 1 | SPI (Phase 3 vibration) |
| Edge → Desktop | WebSocket (JSON, 10 Hz) | ✅ Phase 1 | — |
| Edge → SCADA | Modbus TCP (port 5020) | ✅ Phase 1 | — |
| Edge → Fieldbus | Modbus RTU (RS485) | ⚠️ Implemented, untested | — |
| Discovery | mDNS (Zeroconf) + subnet scan | ✅ Phase 1 | — |
| Edge → Cloud | — | ❌ Not implemented | MQTT TLS (Phase 5) |
| Cloud → Clients | — | ❌ Not implemented | REST + WebSocket (Phase 5) |
| Future | OPC-UA | ❌ Future | Phase 5+ |

Full protocol documentation: [PROTOCOLS.md](PROTOCOLS.md)
Modbus register map: [MODBUS.md](MODBUS.md)
