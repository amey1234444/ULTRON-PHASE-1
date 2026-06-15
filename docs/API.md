# API.md
## ULTRON — Backend API Documentation

**Purpose:** Complete reference for all REST and WebSocket API endpoints.
**Last Updated:** 2026-06-02
**Audience:** Frontend developers, SCADA engineers, integration developers

> Cross-references: [MODBUS.md](MODBUS.md) | [PROTOCOLS.md](PROTOCOLS.md) | [SOFTWARE.md](SOFTWARE.md)

---

## Base URL

```
http://<device-ip>:8000
```

Default device IPs:
- Development (local): `http://localhost:8000`
- Raspberry Pi (auto-discovered): `http://ultron-edge.local:8000`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [GET /health](#2-get-health)
3. [GET /device](#3-get-device)
4. [GET /api/device/identity](#4-get-apideviceidentity)
5. [GET /sensors/latest](#5-get-sensorslatest)
6. [GET /api/modbus/status](#6-get-apimodbustatus)
7. [GET /api/modbus/register-map](#7-get-apimodbusregister-map)
8. [WebSocket /ws](#8-websocket-ws)
9. [Error Responses](#9-error-responses)
10. [Simulation Mode Behaviour](#10-simulation-mode-behaviour)
11. [CORS Policy](#11-cors-policy)
12. [Future APIs](#12-future-apis)

---

## 1. Authentication

**Phase 1:** No authentication. All endpoints are publicly accessible on the local network.

> **Security note:** ULTRON is designed for trusted local networks only. Do not expose port 8000 or 5020 to the public internet without adding authentication. See [SECURITY.md](SECURITY.md).

Future: JWT bearer token or API key authentication. See [DECISIONS.md](DECISIONS.md).

---

## 2. GET /health

**Purpose:** Liveness probe — confirms the server is running.

**Tags:** System

### Request

```http
GET /health HTTP/1.1
Host: 192.168.1.100:8000
```

No parameters. No body.

### Response 200 OK

```json
{
  "status": "ok",
  "uptime_seconds": 3661.5,
  "mode": "simulated",
  "version": "1.0.0"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always `"ok"` if server is running |
| `uptime_seconds` | float | Seconds since server start |
| `mode` | string | `"simulated"` or `"hardware"` |
| `version` | string | Software version |

### Use Case

- Health check before connecting WebSocket
- Monitoring / watchdog service
- Tauri app startup probe

---

## 3. GET /device

**Purpose:** Static device metadata — device ID, sensor names, current mode.

**Tags:** System

### Request

```http
GET /device HTTP/1.1
Host: 192.168.1.100:8000
```

### Response 200 OK

```json
{
  "device_id": "RPi4-ULTRON-001",
  "app_name": "ULTRON",
  "version": "1.0.0",
  "pressure_sensor": "PSN-001",
  "temperature_sensor": "TSN-001",
  "broadcast_interval_ms": 100,
  "mode": "simulated"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `device_id` | string | Unique device identifier (set in `.env` `DEVICE_ID`) |
| `app_name` | string | Application name |
| `version` | string | Software version |
| `pressure_sensor` | string | Pressure sensor name/tag |
| `temperature_sensor` | string | Temperature sensor name/tag |
| `broadcast_interval_ms` | int | WebSocket broadcast interval in milliseconds |
| `mode` | string | `"simulated"` or `"hardware"` |

---

## 4. GET /api/device/identity

**Purpose:** Device identity for auto-discovery clients. Returns which protocols are available.

**Tags:** System

### Request

```http
GET /api/device/identity HTTP/1.1
Host: 192.168.1.100:8000
```

### Response 200 OK

```json
{
  "device_name": "ULTRON Edge",
  "device_type": "raspberry_pi_gateway",
  "hostname": "ultron-edge",
  "serial_number": "Unknown / needs verification",
  "software_version": "1.0.0",
  "supported_protocols": ["websocket", "modbus_tcp"],
  "api_port": 8000,
  "modbus_tcp_port": 5020
}
```

| Field | Type | Description |
|-------|------|-------------|
| `device_name` | string | Human-readable name (set in `.env` `DEVICE_NAME`) |
| `device_type` | string | Always `"raspberry_pi_gateway"` in Phase 1 |
| `hostname` | string | mDNS hostname (without `.local`) |
| `serial_number` | string | Serial number (not yet implemented) |
| `software_version` | string | Software version |
| `supported_protocols` | array | List of active protocols: `"websocket"`, `"modbus_tcp"`, `"modbus_rtu"` |
| `api_port` | int | REST + WebSocket port |
| `modbus_tcp_port` | int | Modbus TCP port |

### Use Case

- Device discovery: the desktop app calls this endpoint on discovered IPs to confirm they are ULTRON devices
- The standalone discovery agent (`ultron-discovery/discovery_agent.py`) uses this endpoint

---

## 5. GET /sensors/latest

**Purpose:** Returns the most recent sensor reading as a one-shot REST response (for clients that don't need WebSocket).

**Tags:** Sensors

### Request

```http
GET /sensors/latest HTTP/1.1
Host: 192.168.1.100:8000
```

### Response 200 OK (reading available)

```json
{
  "reading": {
    "timestamp": "2026-06-02T10:00:00+00:00",
    "pressure": 7.35,
    "temperature": 82.1,
    "status": "healthy"
  },
  "message": "ok"
}
```

### Response 200 OK (server just started — no reading yet)

```json
{
  "reading": null,
  "message": "No reading available yet — server may still be initialising"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `reading` | object or null | Latest sensor reading, or null if not yet available |
| `reading.timestamp` | string | ISO-8601 UTC timestamp |
| `reading.pressure` | float | P1 pressure in bar |
| `reading.temperature` | float | MT2 temperature in °C |
| `reading.status` | string | `healthy`, `warning`, `critical`, or `offline` |
| `message` | string | Status message |

### Use Case

- One-shot read (polling clients, scripts, cURL)
- Initial data load before WebSocket connects
- REST-only integrations

---

## 6. GET /api/modbus/status

**Purpose:** Returns the runtime status of the Modbus subsystem.

**Tags:** Modbus

### Request

```http
GET /api/modbus/status HTTP/1.1
Host: 192.168.1.100:8000
```

### Response 200 OK

```json
{
  "tcp_enabled": true,
  "tcp_running": true,
  "tcp_host": "0.0.0.0",
  "tcp_port": 5020,
  "rtu_enabled": false,
  "rtu_running": false,
  "rtu_port": "/dev/ttyUSB0",
  "slave_id": 1,
  "byte_order": "ABCD",
  "compat_registers": true,
  "register_updates": 15042,
  "last_update": "2026-06-02T10:05:00+00:00"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `tcp_enabled` | bool | Whether TCP is enabled in config |
| `tcp_running` | bool | Whether TCP server is currently running |
| `tcp_host` | string | Bind address |
| `tcp_port` | int | TCP port |
| `rtu_enabled` | bool | Whether RTU is enabled in config |
| `rtu_running` | bool | Whether RTU server is currently running |
| `rtu_port` | string | Serial port path |
| `slave_id` | int | Modbus slave ID |
| `byte_order` | string | Float32 encoding: `ABCD`, `CDAB`, `BADC`, or `DCBA` |
| `compat_registers` | bool | Whether compatibility integer registers are active |
| `register_updates` | int | Total number of register update cycles since startup |
| `last_update` | string or null | Timestamp of last register update |

---

## 7. GET /api/modbus/register-map

**Purpose:** Returns the complete, human-readable Modbus register documentation as JSON.

**Tags:** Modbus

### Request

```http
GET /api/modbus/register-map HTTP/1.1
Host: 192.168.1.100:8000
```

### Response 200 OK

```json
{
  "function_code": 4,
  "function_code_description": "Read Input Registers (FC4) — sensor values are read-only",
  "address_notation": "Display address = PDU address + 30001",
  "float32_encoding": "Two consecutive 16-bit registers; high word at lower address. Byte order configurable: ABCD (default), CDAB, BADC, DCBA.",
  "normal_operating_ranges": {
    "pressure_bar":     {"min": 6.0,  "max": 8.0},
    "temperature_degc": {"min": 70.0, "max": 90.0}
  },
  "registers": [
    {
      "display_address": "30001-30002",
      "pdu_address": "0-1",
      "name": "Pressure",
      "type": "Float32",
      "unit": "bar",
      "description": "Live pump pressure — two consecutive 16-bit registers, high word first.",
      "example": "7.35 bar → high=0x40EB low=0x851F (ABCD byte order)"
    },
    ...
  ],
  "holding_registers": {
    "note": "Holding registers (FC3, 4xxxx) are RESERVED.",
    "future_use": [...]
  }
}
```

This endpoint returns the same register map documented in [MODBUS.md](MODBUS.md), served as a machine-readable JSON object.

---

## 8. WebSocket /ws

**Purpose:** Real-time sensor data stream at 10 Hz.

**Endpoint:** `ws://<device-ip>:8000/ws`

### Connection

```javascript
const ws = new WebSocket('ws://192.168.1.100:8000/ws');

ws.onmessage = (event) => {
  const reading = JSON.parse(event.data);
  console.log(reading.pressure, reading.temperature, reading.status);
};

ws.onerror = (err) => {
  console.error('WebSocket error:', err);
};

ws.onclose = () => {
  // Reconnect after 3 seconds
  setTimeout(() => connect(), 3000);
};
```

### Message Format

Messages are sent as UTF-8 JSON strings, every 100 ms:

```json
{
  "timestamp":   "2026-06-02T10:00:00.123456+00:00",
  "pressure":    7.35,
  "temperature": 82.1,
  "status":      "healthy"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO-8601 UTC with microseconds |
| `pressure` | float | P1 pressure in bar, 2 decimal places |
| `temperature` | float | MT2 temperature in °C, 1 decimal place |
| `status` | string | System status — see table below |

### Status Values

| Value | Meaning | Trigger Condition |
|-------|---------|-----------------|
| `healthy` | All readings normal | P1 < 8.8 bar AND MT2 < 92.0 °C |
| `warning` | At least one reading high | P1 ≥ 8.8 bar OR MT2 ≥ 92.0 °C |
| `critical` | At least one reading critical | P1 ≥ 10.45 bar OR MT2 ≥ 109.25 °C |
| `offline` | Sensor unreachable | Hardware read exception |

### Client-to-Server Messages

The server accepts client messages on the WebSocket connection but **ignores them** in Phase 1. The WebSocket is a unidirectional data stream from server to client.

### Auto-Reconnect (Frontend Implementation)

The `useWebSocket` hook in the desktop app reconnects automatically after 3 seconds (`RECONNECT_MS = 3000`). The Zustand `connectionStore` tracks `reconnectCount`.

### Broadcast Rate

Default: 100 ms (10 Hz). Configurable via `.env`:
```ini
BROADCAST_INTERVAL_MS=100
```

---

## 9. Error Responses

All REST endpoints return standard HTTP error responses:

### 500 Internal Server Error

```json
{
  "detail": "Internal server error message"
}
```

### 422 Unprocessable Entity

Returned by FastAPI for invalid request parameters (if any).

```json
{
  "detail": [
    {
      "loc": ["query", "param_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### WebSocket Error Handling

The WebSocket connection closes with a close code if an unrecoverable error occurs. The client should reconnect.

---

## 10. Simulation Mode Behaviour

When `SIMULATED=true` (default), all API behaviour is identical to hardware mode except:

- `GET /health` → `"mode": "simulated"`
- `GET /device` → `"mode": "simulated"`
- WebSocket stream → realistic synthetic data with oscillations and random spikes
- Dashboard shows **"SIMULATION MODE"** banner

Simulation data characteristics:
- Pressure: 7.0 ± 0.85 bar base oscillation (45 s period), ± 0.15 bar ripple (5 s), Gaussian noise σ=0.04, spike events ~1/50 s
- Temperature: 80.0 ± 7.5 °C base oscillation (80 s period), ± 1.2 °C ripple (12 s), Gaussian noise σ=0.25, spike events ~1/67 s

See [SOFTWARE.md § 8](SOFTWARE.md#8-simulation-mode) for simulation internals.

---

## 11. CORS Policy

**Current (Development):**
```python
allow_origins=["*"]   # All origins allowed — UNSAFE for production
```

**Recommended for Production:**
```python
allow_origins=["tauri://localhost", "http://localhost:8000"]
```

See [SECURITY.md](SECURITY.md) for production hardening.

---

## 12. Future APIs

These endpoints do not exist yet but are planned:

| Method | Path | Phase | Purpose |
|--------|------|-------|---------|
| POST | `/api/alarms/acknowledge` | Phase 2 | Acknowledge active alarms |
| GET | `/api/sensors/history` | Phase 2 | Retrieve historical readings |
| PUT | `/api/config/thresholds` | Phase 2 | Set alarm thresholds remotely |
| GET | `/api/system/metrics` | Phase 2 | CPU/RAM/disk of Raspberry Pi |
| POST | `/api/auth/login` | Phase 3 | Authentication (JWT) |
| GET | `/api/machines` | Phase 4 | Multi-machine list |
| GET | `/api/machines/{id}/sensors` | Phase 4 | Per-machine sensor data |
| WS | `/ws/{machine_id}` | Phase 4 | Per-machine WebSocket stream |

### OpenAPI / Swagger Docs

FastAPI auto-generates interactive API documentation:

```
http://<device-ip>:8000/docs       ← Swagger UI
http://<device-ip>:8000/redoc      ← ReDoc
http://<device-ip>:8000/openapi.json  ← OpenAPI schema
```
