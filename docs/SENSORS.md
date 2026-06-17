# SENSORS.md
## ULTRON — Sensor Knowledge Base

**Purpose:** Define every sensor type used or planned in ULTRON — technology, wiring, mounting, calibration, and failure modes.
**Last Updated:** 2026-06-02
**Audience:** Hardware engineers, software engineers, commissioning technicians

> Cross-references: [HARDWARE.md](HARDWARE.md) | [MACHINES.md](MACHINES.md) | [MODBUS.md](MODBUS.md)

---

## Sensor Status Summary

| Tag | Name | Technology | Status | Phase |
|-----|------|-----------|--------|-------|
| P1 | Inlet Pressure | 4–20 mA pressure transmitter | ✅ Active (simulated) | Phase 1 |
| MT2 | Outlet Material Temperature | 1-Wire DS18B20 | ✅ Active (simulated) | Phase 1 |
| P2 | Outlet Pressure | 4–20 mA pressure transmitter | ❌ Not installed | Phase 1 optional |
| DP1 | Differential Pressure | DP transmitter | ❌ Not installed | Phase 1 optional |
| MT1 | Inlet Material Temperature | 1-Wire DS18B20 or PT100 | ❌ Not installed | Phase 1 optional |
| BT1 | DS Bearing Temperature | PT100 RTD | ❌ Not installed | Phase 2 |
| BT2 | NDS Bearing Temperature | PT100 RTD | ❌ Not installed | Phase 2 |
| RPM1 | Rotor Speed | Inductive proximity | ❌ Not installed | Phase 2 |
| ZS1 | Zero-Speed Detection | Zero-speed switch | ❌ Not installed | Phase 2 |
| M1 | Motor Current | CT + transmitter | ❌ Not installed | Phase 2 |
| V1 | DS Vibration | 4–20 mA vibration transmitter | ❌ Not installed | Phase 3 |
| V2 | NDS Vibration | 4–20 mA vibration transmitter | ❌ Not installed | Phase 3 |

---

## Sensor 1 — Pressure (P1, P2)

### Purpose

Measure gas or air pressure at the inlet (P1) and outlet (P2) zones of the rotary valve.
- P1 detects high-pressure events, blockages, and process upsets
- P2 (with P1) enables differential pressure calculation for seal integrity monitoring

### Technology

**4–20 mA Pressure Transmitter (Industrial Standard)**

| Property | Value |
|----------|-------|
| Output signal | 4–20 mA, two-wire loop-powered |
| Supply voltage | 24 VDC (loop powered) |
| Typical range | 0–10 bar or 0–16 bar (P1); 0–4 bar (P2) |
| Accuracy | ±0.1% to ±0.5% of span (depends on model) |
| Process connection | ½" NPT or G¼" male |
| Environmental | IP65/IP67 |
| Output resolution | Continuous analog (ADC resolution determines measurement resolution) |

**Signal conditioning at Raspberry Pi:**
```
Transmitter output: 4–20 mA
                        |
               [250 Ω shunt resistor]   → 1.0 V (4 mA) to 5.0 V (20 mA)
                        |
               [ADS1115 ADC AIN0]       → 16-bit digital value
                        |
               [I2C to Raspberry Pi]
```

**Conversion formula:**
```python
# Raw ADS1115 reading → pressure in bar
voltage = (raw / 32767) * 4.096        # ADS1115 ±4.096V range
current_mA = voltage / 0.250           # 250 Ω shunt
pressure_bar = (current_mA - 4) / 16 * span  # span = max_bar
```

### Mounting

- Mount on side wall of inlet/outlet duct within 300 mm of valve flange
- Orient process connection sideways or downward — not upward (prevents condensate trap)
- Install process isolation valve (ball valve) below transmitter for maintenance isolation
- Avoid mounting in dead-end pockets where material can accumulate

### Wiring

- Two-wire loop: 24 VDC (+) → transmitter (+) → transmitter (−) → 250 Ω shunt → GND
- Shielded cable: 2-core 0.5 mm², shield grounded at control panel end only
- Keep away from high-voltage cables (minimum 150 mm separation)

### Expected Range

| Parameter | Value |
|-----------|-------|
| P1 operating range | 4.0 – 11.0 bar (software limits) |
| P1 normal band | 6.0 – 8.0 bar |
| P1 warning | ≥ 8.8 bar |
| P1 critical | ≥ 10.45 bar |
| P2 operating range | Unknown / needs verification |

### Calibration

1. Apply 4 mA (0 bar) — verify software reads minimum pressure
2. Apply 20 mA (full scale) — verify software reads maximum pressure
3. Mid-range check: 12 mA → 50% of span
4. Compare to reference gauge (deadweight tester or calibrated comparator)
5. Record calibration date and instrument tag

### Failure Modes

| Failure | Symptom | Action |
|---------|---------|--------|
| Open circuit (cable break) | Output drops to 0 mA — software reads below 4 mA | Check cable continuity |
| Short circuit | Output saturates at 24 VDC — ADC overrange | Check wiring |
| Plugged impulse line | Reading freezes — no variation | Clear blocking, check isolation valve |
| Process ingress | Erratic readings | Clean/replace transmitter |
| Supply voltage loss | Output = 0 | Check 24 VDC supply |

### Recommended Industrial Models

- Endress+Hauser Cerabar PMC71
- Siemens SITRANS P310
- ABB 265G / 2600T
- Vega VEGABAR 82

---

## Sensor 2 — Temperature (MT1, MT2)

### Purpose

Measure material temperature at inlet (MT1) and outlet (MT2) of the valve.
Detect overheating from friction, process upset, or rotor jam.

### Technology Option A — 1-Wire DS18B20 (Current Phase 1 Choice)

| Property | Value |
|----------|-------|
| Output | Digital 1-Wire protocol |
| Measurement range | −55 °C to +125 °C |
| Accuracy | ±0.5 °C (−10 °C to +85 °C) |
| Resolution | 12-bit (0.0625 °C) |
| Interface | Single GPIO pin (GPIO 27 BCM) |
| Supply | 3.3 V or 5 V from GPIO header |
| Pull-up | 4.7 kΩ to 3.3 V required |

**Raspberry Pi setup:**
```
/boot/config.txt (or /boot/firmware/config.txt):
    dtoverlay=w1-gpio

Load kernel modules:
    modprobe w1-gpio
    modprobe w1-therm

Read from filesystem:
    /sys/bus/w1/devices/28-XXXXXXXXXXXX/w1_slave
```

**Python read:**
```python
with open('/sys/bus/w1/devices/28-*/w1_slave') as f:
    lines = f.readlines()
# lines[0] must end in "YES" (CRC OK)
# lines[1] contains "t=XXXXX" where XXXXX / 1000.0 = °C
```

### Technology Option B — PT100 RTD (Industrial Upgrade)

| Property | Value |
|----------|-------|
| Output | Resistance (100 Ω at 0 °C) |
| Measurement range | −200 °C to +600 °C |
| Accuracy | Class A: ±0.15 °C at 0 °C |
| Signal conditioning | 4–20 mA head transmitter |
| Interface | Same as pressure (ADS1115 ADC) |

Use PT100 RTD when:
- Cable runs exceed 20 m (DS18B20 has length limitations)
- Higher accuracy required
- Process temperature exceeds 125 °C

### Mounting

- For contact measurement: insert into thermowell in duct wall, or surface-mount on duct flange
- Thermowell protects sensor from material flow and allows replacement without shutdown
- Ensure good thermal contact between sensor and process surface

### Wiring

- DS18B20: signal wire + GND + 4.7 kΩ pull-up. Shielded cable if > 5 m.
- PT100: 3-wire RTD with 4–20 mA head transmitter — same loop wiring as pressure sensor

### Expected Range

| Parameter | Value |
|-----------|-------|
| Operating range | 50.0 – 115.0 °C (software limits) |
| Normal band | 70.0 – 90.0 °C |
| Warning threshold | ≥ 92.0 °C |
| Critical threshold | ≥ 109.25 °C |

### Calibration

1. Ice bath (0 °C) — verify software reads 0 °C ± tolerance
2. Boiling water (100 °C at sea level) — verify reads ~100 °C
3. Or: compare to calibrated reference thermometer in controlled temperature bath

### Failure Modes

| Failure | Symptom | Action |
|---------|---------|--------|
| DS18B20 CRC failure | `lines[0]` does not end in "YES" | Check cable, replace sensor |
| No 1-Wire device found | `/sys/bus/w1/devices/28-*` not found | Check pull-up resistor, check overlay config |
| Stuck reading | Temperature frozen at one value | Check 1-Wire bus, replace sensor |
| Open circuit (PT100) | Reading goes to maximum | Check cable |
| Short circuit (PT100) | Reading goes to minimum | Check cable |

---

## Sensor 3 — Bearing Temperature (BT1, BT2)

### Purpose

Monitor bearing temperature to detect early bearing failure before catastrophic breakdown.
Bearing temperature typically rises 2–6 weeks before failure.

### Technology

PT100 RTD (surface-mount probe) with 4–20 mA transmitter head

| Property | Value |
|----------|-------|
| Type | PT100 Class A RTD |
| Mounting | Surface-mount in drilled pocket or adhesive pad |
| Range | 0 – 150 °C (typical bearing range) |
| Output | 4–20 mA (via transmitter head) |

### Mounting

- Drive-side (BT1): drill and tap into bearing housing, as close to outer race as possible
- NDS (BT2): same, non-drive-side bearing housing
- Clean mounting surface thoroughly; use thermal paste for surface mount
- Cable strain relief essential (vibration environment)

### Expected Range

| Parameter | Value |
|-----------|-------|
| Normal | Ambient + 15 °C to ambient + 40 °C |
| Warning threshold | Unknown / needs verification (typically baseline + 15 °C) |
| Critical threshold | Unknown / needs verification (typically 90 °C absolute or baseline + 30 °C) |

> **Note:** Establish baseline bearing temperature under normal running conditions before setting alarms.

### Failure Modes

- RTD probe physically damaged by vibration — use strain relief and flexible conduit
- Mounting pocket too shallow — poor thermal contact — ensure sensor tip touches metal

---

## Sensor 4 — Rotor Speed / RPM (RPM1)

### Purpose

Measure actual rotor shaft speed to:
- Confirm rotor is turning at correct speed
- Detect underload or overload
- Derive zero-speed condition (ZS1)

### Technology

**Inductive Proximity Sensor + Target on Shaft**

| Property | Value |
|----------|-------|
| Type | Inductive proximity (PNP NO) |
| Output | Digital pulse (one pulse per target pass) |
| Supply | 24 VDC (3-wire) |
| Interface | Raspberry Pi GPIO (pulse counting) |
| Sensing gap | 1–3 mm (metallic target) |
| Housing | M12 cylindrical, IP67 |

**Target:** A drilled hole, protruding bolt, or gear tooth on the rotating shaft flange. Each pass generates one pulse.

**RPM calculation:**
```python
# Count pulses in N seconds, multiply to get RPM
# With 1 pulse per revolution:
rpm = (pulse_count / measurement_interval_s) * 60
```

**For low RPM (5–30 RPM), measurement interval should be ≥ 2 seconds for accuracy.**

### Alternative Technology

Hall-effect sensor + magnet on shaft (works with non-metallic shafts).

### Mounting

- Mount sensor body in a bracket welded or bolted to gearbox/end plate
- Target (hole or bolt) machined into shaft coupling or end-face
- Align sensor axis perpendicular to shaft rotation
- Protect sensor from material ingress (IP67)

### Expected Range

| Parameter | Value |
|-----------|-------|
| Typical speed | 5 – 30 RPM |
| Warning (low speed) | Unknown / needs verification |
| Critical (zero speed) | 0 RPM — ZS1 = 1 |

### Failure Modes

- Target damaged or missing — no pulses — reads 0 RPM
- Sensing gap too large — intermittent pulses — unstable reading
- Cable shield pickup — false pulses — check grounding

---

## Sensor 5 — Zero-Speed Detection (ZS1)

### Purpose

Provide a binary (on/off) signal that the rotor has completely stopped. Simpler and more reliable than deriving zero-speed from RPM1. Used for safety interlocks.

### Technology Options

**Option A — Dedicated Zero-Speed Switch**
- Purpose-built relay that de-energises when rotation stops
- Examples: Nortek CS4, Danaher ZSD series
- Output: normally-closed relay contact
- Interface: GPIO (digital input, pulled high)

**Option B — Derived from RPM1**
- Software: if RPM1 < 1 for > 2 seconds → ZS1 = 1
- No additional hardware required

### Expected Behaviour

| State | ZS1 Value | Meaning |
|-------|-----------|---------|
| 0 | Running | Shaft is rotating normally |
| 1 | Stopped | Shaft has stopped |

> If ZS1 = 1 while machine should be running → **CRITICAL alarm**

---

## Sensor 6 — Vibration (V1, V2)

### Purpose

Measure mechanical vibration at bearing housings to detect:
- Bearing defects (inner race, outer race, rolling element, cage)
- Rotor imbalance
- Shaft misalignment
- Looseness

### Technology — 4–20 mA Vibration Transmitter (RMS Velocity)

| Property | Value |
|----------|-------|
| Output | 4–20 mA (proportional to vibration RMS) |
| Measurement | Overall RMS velocity in mm/s |
| Frequency range | 10 Hz – 1 kHz (typical) |
| Supply | 24 VDC loop |
| Interface | ADS1115 ADC (same as pressure) |
| Housing | M8 or M12 stud-mount or magnet-mount |

**This gives one number (overall vibration level) per sensor per update cycle.**

### Technology (Advanced) — IEPE Accelerometer + High-Speed ADC

For FFT analysis (Phase 3):
- IEPE accelerometer (constant current supply, AC-coupled)
- Requires: SPI high-speed ADC (e.g., ADS8688) or dedicated DAQ board
- Outputs raw waveform → FFT computed on Raspberry Pi → bearing fault frequencies extracted

### Alarm Thresholds (ISO 10816 reference)

| Zone | Velocity RMS | Classification |
|------|-------------|---------------|
| A | < 2.3 mm/s | New equipment (acceptable) |
| B | 2.3 – 4.5 mm/s | Acceptable for long-term |
| C | 4.5 – 7.1 mm/s | Warning — investigate |
| D | > 7.1 mm/s | Critical — immediate action |

> Verify against manufacturer specs for this specific machine class.

### Mounting

- Stud-mount: threaded boss welded to bearing housing — best accuracy
- Magnet-mount: acceptable for occasional measurements, not permanent installation
- Direction: radial (perpendicular to shaft) preferred; axial also useful for misalignment

### Failure Modes

- Stud loose — reduced high-frequency sensitivity
- Cable broken — output drops to 4 mA (0 mm/s apparent)
- Sensor damaged by impact — reads constantly high or erratic

---

## Sensor 7 — Motor Current (M1)

### Purpose

Monitor motor electrical load:
- Detect mechanical overload (rotor jam, material blockage)
- Detect motor tripping
- Long-term trend indicates increasing mechanical resistance

### Technology

**Split-Core Current Transformer (CT) + 4–20 mA Transmitter**

| Property | Value |
|----------|-------|
| CT type | Split-core (clamps around one phase conductor) |
| CT ratio | Depends on motor FLC (e.g., 50:5 A) |
| Output | 4–20 mA (via CT transmitter) |
| Interface | ADS1115 ADC |
| Mounting location | Motor terminal box or MCC panel |

**Safety:** Never open-circuit a CT secondary while the primary is energised. Always short the secondary before disconnecting.

### Configuration

1. Read motor nameplate: note Full Load Current (FLC)
2. Select CT with primary rating ≥ 110% of FLC
3. Set transmitter: 4 mA = 0 A, 20 mA = CT_primary_rating A
4. Set alarm: warning at 110% FLC, critical at 125% FLC

### Expected Range

| Parameter | Value |
|-----------|-------|
| FLC | Unknown / needs verification (depends on motor) |
| Warning | Unknown / needs verification |
| Critical | Unknown / needs verification |

---

## Sensor 8 — Differential Pressure (DP1)

### Purpose

Direct measurement of pressure drop across the rotary valve (P1 − P2).
More accurate than calculating from two separate pressure transmitters.

### Technology

**Differential Pressure (DP) Transmitter**

| Property | Value |
|----------|-------|
| Output | 4–20 mA |
| Measurement | Differential: high-side minus low-side |
| Range | 0 – 10 bar differential (Unknown / needs verification) |
| Interface | ADS1115 ADC |

### Mounting

Two process connections: one to inlet tap (P1 side), one to outlet tap (P2 side).
Can be mounted on a valve manifold with both taps.

### Expected Range

Unknown / needs verification — depends on process conditions.

---

## Sensor Interface Summary for Raspberry Pi

| Sensor | Signal Type | Interface | GPIO / Port |
|--------|------------|-----------|------------|
| P1 Pressure | 4–20 mA → 1–5 V | ADS1115 AIN0 (I2C) | GPIO 2/3 (SDA/SCL) |
| MT2 Temperature | 1-Wire digital | GPIO 27 direct | GPIO 27 |
| P2 Pressure (future) | 4–20 mA → 1–5 V | ADS1115 AIN1 (I2C) | GPIO 2/3 (SDA/SCL) |
| BT1/BT2 Bearing Temp (future) | 4–20 mA → 1–5 V | ADS1115 AIN2/AIN3 | GPIO 2/3 (SDA/SCL) |
| RPM1 Speed (future) | Digital pulse (24V) | GPIO (with level shifter) | TBD |
| ZS1 Zero-Speed (future) | Digital contact | GPIO (pull-up) | TBD |
| V1/V2 Vibration (future) | 4–20 mA → 1–5 V | Second ADS1115 (I2C) | GPIO 2/3 (SDA/SCL, addr 0x49) |
| M1 Current (future) | 4–20 mA → 1–5 V | ADS1115 or second board | TBD |

> The ADS1115 has 4 differential input channels (AIN0–AIN3) per board.
> Multiple ADS1115 boards can be connected to the same I2C bus with different addresses (ADDR pin).
