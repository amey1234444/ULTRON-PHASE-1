# TESTING.md
## ULTRON — Testing Strategy

**Purpose:** Define testing requirements, procedures, and acceptance criteria for all ULTRON components.
**Last Updated:** 2026-06-02
**Audience:** Developers, QA engineers, hardware commissioning team

> Cross-references: [DEPLOYMENT.md](DEPLOYMENT.md) | [HARDWARE.md](HARDWARE.md) | [API.md](API.md)

---

## Testing Status

| Test Category | Status |
|--------------|--------|
| Backend unit tests (modbus) | ✅ Partial — `tests/test_modbus.py` exists |
| Backend integration tests | ❌ Not implemented |
| Frontend unit tests | ❌ Not implemented |
| Frontend E2E tests | ❌ Not implemented |
| TypeScript type checking | ✅ `npm run type-check` — 0 errors |
| Simulation validation | ✅ Manual (via dashboard) |
| Modbus TCP validation | ✅ Manual (pymodbus client) |
| Hardware sensor validation | ❌ Hardware not yet connected |
| Production build test | ❌ Not yet verified |

---

## 1. Backend Tests

### Existing Tests

**File:** `ultron-backend/tests/test_modbus.py`

Tests the Modbus conversion utilities (Float32 encoding/decoding, UInt32 packing).

**Run:**
```powershell
cd ultron-backend
.venv\Scripts\activate
python -m pytest tests/ -v
```

### Required Tests (Not Yet Implemented)

#### Unit Tests

| Test | File | What to Test |
|------|------|-------------|
| Float32 ABCD encode/decode | `test_modbus.py` | `decode_float32(encode_float32(7.35)) == 7.35` |
| Float32 CDAB encode/decode | `test_modbus.py` | Verify CDAB byte swap correctness |
| UInt32 high/low word split | `test_modbus.py` | `3661 seconds → high=0, low=0x0E4D` |
| Alarm status derivation | `test_sensor_manager.py` | Pressure 8.8 → Warning, 10.45 → Critical |
| Health status derivation | `test_sensor_manager.py` | Both sensors normal → healthy |
| SimulatedPressureSensor bounds | `test_sensor_manager.py` | Always within [pressure_min, pressure_max] |
| SimulatedTemperatureSensor bounds | `test_sensor_manager.py` | Always within [temp_min, temp_max] |
| Config loading from env | `test_config.py` | `.env` values correctly parsed |

#### Integration Tests

| Test | Description |
|------|-------------|
| WebSocket connect + receive | Connect to WS, receive 3 messages, verify schema |
| REST /health | Returns `{"status": "ok", ...}` |
| REST /sensors/latest | Returns a valid SensorReading |
| REST /api/device/identity | Returns device identity with correct protocols list |
| REST /api/modbus/status | Returns Modbus status |
| Modbus TCP read | Read registers 30001–30004, decode Float32, verify range |
| Modbus register heartbeat | Read register 30012 twice, verify it incremented |

### Running Backend with Test Config

```powershell
# Test with custom limits
$env:PRESSURE_MIN = "0"
$env:PRESSURE_MAX = "20"
$env:SIMULATED = "true"
python -m uvicorn app.main:app --port 8000
```

---

## 2. Frontend Tests

### Current State

No frontend tests are implemented in Phase 1.

### TypeScript Check (Available Now)

```powershell
cd ultron-desktop
npm run type-check
# Expected: 0 errors
```

### Recommended Test Stack (Future)

| Tool | Purpose |
|------|---------|
| Vitest | Unit + integration tests (Vite-native, replaces Jest) |
| React Testing Library | Component rendering tests |
| Playwright | E2E tests (browser automation) |
| MSW (Mock Service Worker) | Mock WebSocket + REST for frontend tests |

### Priority Frontend Tests (Future)

| Test | What to Verify |
|------|---------------|
| `computeHealthScore` | Returns 100 for normal readings, 0 for critical |
| `getSensorStatus` | Returns correct status for boundary values (8.79, 8.8, 8.81 bar) |
| `buildSensorPoints` | P1 → `latest.pressure`, MT2 → `latest.temperature`, others → null |
| `sensorStore` | `addReading` correctly updates `latest`, `readings`, `healthScore`, `alarms` |
| `PressureCard` | Renders correct value and status color |
| Alarm thresholds | Alarm fires exactly at 8.8 bar and 10.45 bar |
| WebSocket reconnect | Reconnects after 3 seconds on close |

---

## 3. Integration Tests

### Manual Integration Test Procedure (Current)

This is the current acceptance test before any major feature release:

**Prerequisite:** Backend running (`uvicorn app.main:app --port 8000`)

#### WebSocket Test

```
1. Open ULTRON Desktop app
2. Verify: connection status shows "CONNECTED"
3. Verify: pressure gauge updates every ~100 ms
4. Verify: temperature gauge updates every ~100 ms
5. Verify: trend chart shows growing historical line
6. Stop backend → verify: status shows "DISCONNECTED"
7. Restart backend → verify: auto-reconnects within 5 seconds
```

#### Alarm Test

```
1. In .env: set PRESSURE_MAX=9.0 (lowers warning threshold to 7.2 bar, critical to 8.55 bar)
2. Restart backend
3. Wait for simulation to hit warning → verify: gauge turns amber
4. Wait for simulation to hit critical → verify: gauge turns red, alarm panel shows row
5. Click ACK → alarm acknowledged
6. Restore .env to defaults
```

#### Modbus TCP Test

```powershell
python -c "
from pymodbus.client import ModbusTcpClient
import struct
c = ModbusTcpClient('localhost', port=5020)
c.connect()
# Read pressure + temperature
r = c.read_input_registers(0, 4)
p = struct.unpack('>f', struct.pack('>HH', r.registers[0], r.registers[1]))[0]
t = struct.unpack('>f', struct.pack('>HH', r.registers[2], r.registers[3]))[0]
print(f'Pressure: {p:.2f} bar, Temperature: {t:.1f} C')
# Verify range
assert 1.0 <= p <= 15.0, f'Pressure out of range: {p}'
assert 20.0 <= t <= 120.0, f'Temperature out of range: {t}'
# Read heartbeat twice
h1 = c.read_input_registers(11, 1).registers[0]
import time; time.sleep(0.2)
h2 = c.read_input_registers(11, 1).registers[0]
assert h2 != h1, 'Heartbeat not incrementing'
print('All Modbus tests passed')
c.close()
"
```

#### mDNS Discovery Test

```
1. Start backend on Raspberry Pi
2. Open ULTRON Desktop
3. On Discovery screen: verify device appears automatically (without manual IP)
4. Click connect → verify WebSocket data streams
```

---

## 4. Hardware Validation

### Pressure Sensor (P1) Validation

**Required before deploying hardware mode:**

```
1. Wire ADS1115 ADC to Raspberry Pi I2C (SDA=GPIO2, SCL=GPIO3)
2. Wire 4-20mA sensor through 250Ω shunt to ADS1115 AIN0
3. Implement HardwarePressureSensor.read() (currently NotImplementedError)
4. Set SIMULATED=false in .env
5. Apply known pressure (e.g., 0 bar from calibration pump) → verify software reads ≤ PRESSURE_MIN
6. Apply 50% pressure → verify software reads ≈ midpoint
7. Apply full scale pressure → verify software reads ≤ PRESSURE_MAX
8. Compare to reference gauge (deadweight tester or calibrated comparator)
9. Record calibration data
```

**Acceptance Criteria:**
- Software reading within ±2% of reference gauge
- No crashes or exceptions during 1 hour of continuous operation
- Alarm thresholds trigger at correct pressure values

### Temperature Sensor (MT2) Validation

**Required before deploying hardware mode:**

```
1. Enable 1-Wire on Raspberry Pi: add dtoverlay=w1-gpio to /boot/config.txt
2. Connect DS18B20 with 4.7kΩ pull-up to GPIO 27
3. Verify device appears: ls /sys/bus/w1/devices/28-*
4. Set SIMULATED=false in .env
5. Read temperature in known environment (room temperature ~25°C) → verify reading
6. Place sensor in ice water (0°C) → verify reads ~0°C ± 0.5°C
7. Place sensor in boiling water (100°C at sea level) → verify reads ~100°C ± 1°C
8. Compare to calibrated reference thermometer
```

**Acceptance Criteria:**
- Software reading within ±1°C of reference
- DS18B20 CRC errors: 0 over 1 hour
- No crashes during 1 hour of continuous operation

### Modbus RTU Validation

```
1. Connect USB-RS485 adapter to Raspberry Pi USB port
2. Set MODBUS_RTU_ENABLED=true in .env
3. Set MODBUS_RTU_PORT=/dev/ttyUSB0 (or actual port)
4. Restart backend
5. Connect Modbus RTU master (Modbus Poll or similar) to RS485 bus
6. Read input registers 0-3 (30001-30004)
7. Verify Float32 values match WebSocket values
8. Verify heartbeat register increments
```

---

## 5. Simulation Validation

### Purpose

Ensure the simulation produces realistic data that exercises all alarm states.

### Procedure

```
1. Start backend in SIMULATED=true mode
2. Open dashboard
3. Observe for 5 minutes minimum
4. Verify:
   - Pressure oscillates between 6-8 bar normally
   - Temperature oscillates between 70-90°C normally
   - At least one pressure spike occurs (above 8.8 bar → Warning)
   - At least one temperature spike occurs (above 92°C → Warning)
   - Values never go below min or above max (PRESSURE_MIN/MAX, TEMP_MIN/MAX)
   - Trend chart shows realistic shape (not flat, not erratic)
   - Health score varies (not stuck at 100)
5. Leave running for 30 minutes
6. Verify: no memory leaks (check Raspberry Pi RAM via SystemMetricsCard if on RPi)
```

**Acceptance Criteria:**
- At least 1 Warning alarm per 10-minute period (simulated)
- No Critical alarm more than every 2 minutes (should be rare)
- No crashes or JavaScript errors in console
- Memory stable after 30 minutes

---

## 6. Acceptance Criteria — Phase 1 Complete

The following criteria must all be met before Phase 1 is declared production-ready:

| Criterion | Test Method | Status |
|-----------|------------|--------|
| TypeScript: 0 errors | `npm run type-check` | ✅ Pass |
| Cargo: 0 errors | `cargo build --release` | ✅ Pass |
| Dashboard loads without crash | Manual | ✅ Pass |
| WebSocket connects and streams | Manual | ✅ Pass |
| Gauges update in real-time | Manual | ✅ Pass |
| Alarms trigger at correct thresholds | Manual | ✅ Pass (simulated) |
| Digital twin SVG loads | Manual | ✅ Pass |
| Sensor detail panel opens on click | Manual | ✅ Pass |
| Fullscreen mode works | Manual | ✅ Pass |
| Auto-reconnect after disconnect | Manual | ✅ Pass |
| Modbus TCP reads correct values | Modbus test script | ✅ Pass |
| Hardware pressure sensor reads correctly | Hardware validation | ❌ Not yet (hardware uninstalled) |
| Hardware temperature sensor reads correctly | Hardware validation | ❌ Not yet (hardware uninstalled) |
| Production `.exe` builds and runs | `npm run tauri build` + install | ❌ Not verified |
| Backend starts on Raspberry Pi from production build | Deployment test | ❌ Not verified |
| CORS restricted for production | Code review | ❌ Still `allow_origins=["*"]` |

---

## 7. Manual Testing Procedures

### Testing a New Sensor Addition

When a new sensor is added to Phase 2:

```
1. Backend: verify sensor reads without exception
2. Backend: verify sensor value appears in SensorReading JSON (WebSocket)
3. Backend: verify Modbus register contains correct value
4. Frontend: verify sensor dot on digital twin shows correct value
5. Frontend: verify correct status color (normal/warning/critical)
6. Frontend: verify alarm triggers at correct threshold
7. Frontend: verify sensor detail panel shows correct info
8. Modbus: verify new register decodes to correct engineering value
```

### Testing Theme Switching

```
1. Open dashboard in dark mode → verify all colors correct
2. Toggle to light mode → verify all colors correct, no invisible text
3. Refresh page → verify theme persists (localStorage)
4. Toggle back to dark → verify correct
```
