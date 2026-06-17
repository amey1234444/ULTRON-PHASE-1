# DECISIONS.md
## ULTRON — Architectural Decision Log

**Purpose:** Record all major technical and design decisions — what was chosen, why, when, and whether it is locked or open for revision.
**Last Updated:** 2026-06-02
**Audience:** All engineers, AI agents

> When you make a significant architectural decision, record it here immediately.
> This prevents the same debate from happening twice and provides context for future engineers.

---

## Decision Log

---

### ADR-001 — UI Design Style

| Field | Value |
|-------|-------|
| **Decision** | Select the visual design style for ULTRON Dashboard |
| **Chosen** | Option 3 — SCADA Dark (navy-steel industrial palette) |
| **Date** | 2026 (Phase 8) |
| **Status** | 🔒 LOCKED |
| **Made By** | Oswar Software / Oswar Rotocorp |

**Options Considered:**

| Option | Description | Rejected Because |
|--------|-------------|-----------------|
| Option 1 | Light/white SaaS dashboard | Too consumer; not industrial |
| Option 2 | Generic dark dashboard | Not distinctive enough |
| **Option 3** | Navy-steel SCADA industrial | ✅ CHOSEN — best industrial identity |

**Rationale:**
ULTRON targets industrial plant operators and engineers. A SCADA-style dark palette communicates industrial credibility, reduces eye strain in control room environments, and creates a distinctive brand identity for the platform.

**What is locked:**
- `--surface: #060C18` (deep ocean navy — page background)
- `--panel: #0C1A28` (dark steel — panel background)
- `--accent: #38A0FF` (electric blue — active state)
- `--ok: #20D068` / `--warn: #FFB020` / `--crit: #FF4040` (status colors)
- Overall dark industrial aesthetic

**What can change:**
- Light theme polish (secondary theme)
- Individual component layouts
- Typography sizing
- Adding new components

---

### ADR-002 — Desktop App Framework

| Field | Value |
|-------|-------|
| **Decision** | Framework for ULTRON desktop application |
| **Chosen** | Tauri 2.x (Rust shell + React/TypeScript frontend) |
| **Date** | 2025 (project start) |
| **Status** | 🔒 LOCKED |

**Options Considered:**

| Option | Rejected Because |
|--------|----------------|
| Electron | Large bundle size (~150 MB), high RAM usage |
| **Tauri 2.x** | ✅ CHOSEN — small bundle, native Rust, secure |
| Qt | Requires C++ expertise; slower UI development |
| WPF | Windows-only; no Linux |

**Rationale:**
Tauri provides a native desktop experience with a small binary size (~5–15 MB), uses Rust for security-critical native code, and allows React/TypeScript for the UI — matching the team's skills.

---

### ADR-003 — Backend Framework

| Field | Value |
|-------|-------|
| **Decision** | Python web framework for ULTRON backend |
| **Chosen** | FastAPI + Uvicorn |
| **Date** | 2025 (project start) |
| **Status** | ✅ Locked |

**Rationale:**
FastAPI provides async support (required for concurrent WebSocket + Modbus + sensor reads), auto-generated OpenAPI docs, Pydantic validation, and runs well on Raspberry Pi. Uvicorn is the recommended ASGI server.

---

### ADR-004 — Primary Data Protocol

| Field | Value |
|-------|-------|
| **Decision** | Primary protocol for sensor data streaming to desktop |
| **Chosen** | WebSocket (JSON, 10 Hz) |
| **Date** | 2025 (project start) |
| **Status** | ✅ Locked |

**Rationale:**
WebSocket provides persistent bidirectional connection with low overhead. At 10 Hz (100 ms), WebSocket is far more efficient than polling REST. Modbus TCP is provided as a secondary protocol for industrial integration (PLC/SCADA).

---

### ADR-005 — Industrial Integration Protocol

| Field | Value |
|-------|-------|
| **Decision** | Protocol for PLC/SCADA integration |
| **Chosen** | Modbus TCP + Modbus RTU |
| **Date** | 2025 (project start) |
| **Status** | ✅ Locked |

**Rationale:**
Modbus is the most widely supported industrial protocol. Nearly all PLCs (Siemens, Allen-Bradley, Mitsubishi) and SCADA systems (Ignition, WonderWare, Citect) support Modbus TCP. No alternative was considered — Modbus is the industry standard for this use case.

---

### ADR-006 — State Management

| Field | Value |
|-------|-------|
| **Decision** | Frontend state management library |
| **Chosen** | Zustand |
| **Date** | 2025 (project start) |
| **Status** | ✅ Locked |

**Options Considered:**

| Option | Rejected Because |
|--------|----------------|
| Redux | Too much boilerplate for this scale |
| MobX | Less TypeScript-friendly |
| **Zustand** | ✅ CHOSEN — minimal boilerplate, TypeScript-first, React hooks |
| React Context only | Not suitable for high-frequency sensor updates (re-render storms) |

---

### ADR-007 — Chart Library

| Field | Value |
|-------|-------|
| **Decision** | Chart library for gauges and trend charts |
| **Chosen** | Apache ECharts (via echarts-for-react) |
| **Date** | 2025 (project start) |
| **Status** | ✅ Locked |

**Rationale:**
ECharts provides industrial-quality gauge components (semicircle gauges with threshold zones), high-performance time-series charts, and flexible theming. Supports ResizeObserver for responsive sizing.

---

### ADR-008 — Sensor Simulation Strategy

| Field | Value |
|-------|-------|
| **Decision** | How to simulate sensor data in development |
| **Chosen** | Server-side simulation with realistic industrial physics |
| **Date** | 2025 (project start) |
| **Status** | ✅ Locked |

**Rationale:**
Simulation runs on the backend (Python `SensorManager`), not in the frontend. This means:
1. Simulation and hardware mode use identical code paths on the frontend
2. WebSocket, Modbus TCP, and REST all receive identical data in both modes
3. The switch from simulation to hardware requires only `SIMULATED=false` in `.env`

The simulation models realistic industrial behavior: pump oscillation cycles, thermal inertia, Gaussian noise, EMA smoothing, and random spike events that exercise alarm logic.

---

### ADR-009 — Modbus Float32 Encoding

| Field | Value |
|-------|-------|
| **Decision** | Default byte order for Float32 Modbus registers |
| **Chosen** | ABCD (big-endian, high word first) |
| **Date** | 2025 |
| **Status** | ✅ Locked as default (configurable) |

**Rationale:**
ABCD is the most common byte order in industrial Modbus implementations (Siemens, standard Modbus specification). It is configurable via `MODBUS_BYTE_ORDER` in `.env` to accommodate PLCs that require other orders (e.g., CDAB for some Allen-Bradley). The default must not change as it would break existing PLC integrations.

---

### ADR-010 — Sensor Tag Naming Convention

| Field | Value |
|-------|-------|
| **Decision** | Tag naming convention for all sensor measurements |
| **Chosen** | Instrument type code + number (e.g., P1, MT2, BT1) |
| **Date** | 2025 |
| **Status** | 🔒 LOCKED — active tags cannot be renamed |

**Convention:**

| Prefix | Type | Examples |
|--------|------|---------|
| P | Pressure | P1 (inlet), P2 (outlet) |
| MT | Material Temperature | MT1 (inlet), MT2 (outlet) |
| BT | Bearing Temperature | BT1 (drive-side), BT2 (NDS) |
| V | Vibration (velocity) | V1 (DS), V2 (NDS) |
| RPM | Rotational Speed | RPM1 |
| ZS | Zero Speed | ZS1 |
| M | Motor Current | M1 |
| DP | Differential Pressure | DP1 |

**Why locked:** Tag names appear in code (models.py, sensorPoints.ts, constants.ts), Modbus register documentation, frontend labels, and this engineering knowledge base. Renaming an active tag requires a coordinated change across all components.

---

### ADR-011 — Dashboard Layout Strategy

| Field | Value |
|-------|-------|
| **Decision** | How to layout the main dashboard |
| **Chosen** | Fixed-viewport flex layout (no scroll) |
| **Date** | 2026 (Phase 9) |
| **Status** | ✅ Locked |

**Rationale:**
Operators in a plant environment should see all primary information (gauges, digital twin, trend) without scrolling. The dashboard fills the viewport exactly. Row 1 has fixed height for metric cards; Row 2 uses `flex: 1` to fill remaining space. Charts use `ResizeObserver` for dynamic sizing.

---

### ADR-012 — Device Discovery Protocol

| Field | Value |
|-------|-------|
| **Decision** | How the desktop app finds the Raspberry Pi automatically |
| **Chosen** | mDNS (Zeroconf) primary, subnet scan fallback, Modbus TCP probe tertiary |
| **Date** | 2025 |
| **Status** | ✅ Locked |

**Rationale:**
mDNS is zero-configuration — the RPi advertises itself and the desktop app finds it instantly without any IP configuration. Subnet scan is the fallback when mDNS is blocked (firewall, different LAN segment). Modbus TCP probe detects ULTRON devices from PLC/SCADA discovery tools.

---

### ADR-013 — No Authentication in Phase 1

| Field | Value |
|-------|-------|
| **Decision** | Authentication strategy for Phase 1 |
| **Chosen** | No authentication — trusted local network only |
| **Date** | 2025 |
| **Status** | ⚠️ Phase 1 temporary — must change for production/cloud |

**Rationale:**
Phase 1 is a demo running on a trusted local LAN. Authentication adds complexity that is not needed for the demo. All APIs are GET-only (read-only). No sensitive data is exposed.

**Must change:** Before any internet-exposed deployment or multi-user deployment, add JWT authentication or API key authentication. See [SECURITY.md](SECURITY.md).

---

### ADR-014 — Digital Twin as Inline SVG

| Field | Value |
|-------|-------|
| **Decision** | How to implement the machine digital twin |
| **Chosen** | Inline SVG component (TypeScript/React) |
| **Date** | 2026 (Phase 8) |
| **Status** | ✅ Locked |

**Options Considered:**

| Option | Rejected Because |
|--------|----------------|
| External SVG file (img tag) | Cannot interact with SVG internals from React |
| SVG file imported as component | Harder to position dynamic sensor overlays |
| Canvas (WebGL/2D) | Too complex for schematic diagrams |
| **Inline SVG in TSX** | ✅ CHOSEN — full React control, CSS variables, sensor dot overlays |

**Rationale:**
Inline SVG gives full access to SVG elements from React, allows CSS variable theming (dark/light), and enables dynamic sensor dot overlays and interactive click events.

---

### ADR-015 — Simulation Mode Default

| Field | Value |
|-------|-------|
| **Decision** | Should SIMULATED mode be on or off by default? |
| **Chosen** | `SIMULATED=true` by default |
| **Date** | 2025 |
| **Status** | ✅ Locked |

**Rationale:**
Default simulation mode allows the backend to start cleanly on non-RPi hardware (development machines, CI). Hardware mode (`SIMULATED=false`) is explicitly opted-in by operators deploying on Raspberry Pi. This prevents accidental crashes from missing GPIO/I2C hardware on dev machines.

---

## Template for New Decisions

When adding a new decision, copy this template:

```markdown
### ADR-XXX — Short Title

| Field | Value |
|-------|-------|
| **Decision** | What was being decided |
| **Chosen** | What was selected |
| **Date** | YYYY-MM-DD |
| **Status** | 🔒 LOCKED / ✅ Locked / ⚠️ Temporary / 🔄 Under review |
| **Made By** | Who made the decision |

**Options Considered:** (table of alternatives)

**Rationale:** Why this option was chosen.

**Consequences:** What this decision enables or constrains.
```

## Status Legend

| Symbol | Meaning |
|--------|---------|
| 🔒 LOCKED | Cannot change without explicit team approval + DECISIONS.md update |
| ✅ Locked | Stable decision — changing requires updating this doc |
| ⚠️ Temporary | Known to need change in a future phase |
| 🔄 Under review | Being re-evaluated |
