# HARDWARE.md
## ULTRON Industrial Monitoring Platform — Hardware Reference

**Document Status:** Phase 1 (MVP)
**Last Updated:** 2026-06-02
**Maintained By:** Oswar Software / Oswar Rotocorp
**Audience:** Hardware Engineers, Software Engineers, Interns

> Cross-references: [SENSORS.md](SENSORS.md) | [MODBUS.md](MODBUS.md) | [MACHINES.md](MACHINES.md) | [DEPLOYMENT.md](DEPLOYMENT.md) | [DECISIONS.md](DECISIONS.md)

> This document is the single source of truth for the Hardware Team.
> It defines what sensors are required, where they go, what signal types
> the software expects, and how data flows end-to-end.
> Any hardware change that affects software must be documented here first.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Current Phase Scope](#2-current-phase-scope)
3. [Machine Overview — Rotary Airlock Valve](#3-machine-overview--rotary-airlock-valve)
4. [Sensor Inventory](#4-sensor-inventory)
5. [Sensor Mounting Locations](#5-sensor-mounting-locations)
6. [Hardware Tag Definitions](#6-hardware-tag-definitions)
7. [Software Data Expectations](#7-software-data-expectations)
8. [Communication Architecture](#8-communication-architecture)
9. [Modbus Register Mapping](#9-modbus-register-mapping)
10. [Hardware Requirements](#10-hardware-requirements)
11. [Raspberry Pi Interface Requirements](#11-raspberry-pi-interface-requirements)
12. [Future Expansion Roadmap](#12-future-expansion-roadmap)
13. [Hardware–Software Contract](#13-hardwaresoftware-contract)
14. [Open Hardware Questions](#14-open-hardware-questions)
15. [Hardware Team Action Items](#15-hardware-team-action-items)

---

## 1. Project Overview

### What is ULTRON?

ULTRON is an **Industrial Machine Monitoring Platform** built by Oswar Software / Oswar Rotocorp.

Its purpose is to give plant operators and engineers real-time visibility into the health and condition of industrial machines — directly on a desktop computer — without needing a SCADA system or PLC programmer.

Think of ULTRON as the "heartbeat monitor" for a machine. Sensors attached to the machine send data to a small computer (Raspberry Pi 4). That computer runs the ULTRON backend, which streams data in real time to a desktop application. Operators see live gauges, trend charts, and alarms. When something goes wrong, they know immediately.

### Phase 1 Target Machine

**Rotary Airlock Valve** — a common piece of industrial bulk-material handling equipment used to transfer powders, granules, and pellets between zones of different pressures.

### ULTRON Goals

| Goal | Description |
|------|-------------|
| **Machine Health Monitoring** | Continuously monitor operating conditions (pressure, temperature) |
| **Fault Detection** | Trigger alarms when readings exceed safe thresholds |
| **Real-Time Dashboard** | Stream live data to a desktop application at 10 readings/second |
| **Predictive Maintenance (Future)** | Detect early signs of bearing wear, overheating, or rotor problems |
| **Multi-Machine Expansion (Future)** | Support multiple machine types across a facility |

### Final Architecture Vision

The system is designed to grow. The final architecture will support:

```
[Industrial Sensors]
        ↓
[Signal Conditioning / ADC]
        ↓
[Edge Device — Raspberry Pi 4]
        ↓ (WebSocket / Modbus TCP / Modbus RTU)
[ULTRON Backend — FastAPI]
        ↓ (WebSocket stream)
[ULTRON Desktop — Tauri + React]
        ↓
[Operator Dashboard]
```

**Supported communication protocols (current + future):**

| Protocol | Purpose | Status |
|----------|---------|--------|
| WebSocket | Real-time data streaming to desktop | ✅ Implemented |
| Modbus TCP | Industrial SCADA / PLC integration | ✅ Implemented |
| Modbus RTU | RS485 fieldbus to sensors / instruments | ⚠️ Implemented, untested on hardware |
| mDNS / Zeroconf | Auto-discovery of ULTRON device on network | ✅ Implemented |

---

## 2. Current Phase Scope

### Phase 1 — MVP (Current)

**Machine:** Rotary Airlock Valve
**Edge Device:** Raspberry Pi 4 (8 GB recommended)
**Desktop App:** ULTRON Desktop (Windows, Tauri + React)

#### Currently Monitored (Phase 1)

| Parameter | Tag | Unit | Status |
|-----------|-----|------|--------|
| Inlet Pressure | P1 | bar | ✅ Active (simulated) |
| Outlet Material Temperature | MT2 | °C | ✅ Active (simulated) |

> **Note:** Both sensors are currently running in **simulation mode** — realistic fake data
> is generated in software. The hardware sensor driver stubs exist in the code but are
> not yet fully implemented. See Section 11 for details.

#### Planned for Future Phases (Not Yet Active)

| Parameter | Tag | Unit | Phase |
|-----------|-----|------|-------|
| Outlet Pressure | P2 | bar | Phase 1 optional |
| Inlet Material Temperature | MT1 | °C | Phase 1 optional |
| Drive-Side Bearing Temperature | BT1 | °C | Phase 2 |
| Non-Drive-Side Bearing Temperature | BT2 | °C | Phase 2 |
| Rotor Speed (RPM) | RPM1 | rpm | Phase 2 |
| Zero-Speed Detection | ZS1 | status | Phase 2 |
| Drive-Side Vibration | V1 | mm/s | Phase 3 |
| Non-Drive-Side Vibration | V2 | mm/s | Phase 3 |
| Motor Current | M1 | A | Phase 2 |
| Differential Pressure | DP1 | bar | Phase 1 optional |
| Leakage Detection | — | — | Future |

---

## 3. Machine Overview — Rotary Airlock Valve

### What is a Rotary Airlock Valve?

A Rotary Airlock Valve (also called a rotary valve, rotary feeder, or star feeder) is a piece of process equipment used in bulk material handling systems.

**Primary Function:**
- Transfer dry bulk solids (powder, pellets, granules, flour, cement, etc.) from one zone to another
- Maintain an **airlock (pressure seal)** between an upper high-pressure zone and a lower zone, preventing gas or air from escaping while allowing material to flow through

### Machine Anatomy

```
                    INLET
                  (Top Flange)
                      |
              +-------+-------+
              |               |   ← Inlet Hopper / Upper Casing
              |   [Material   |
              |    Pockets]   |
              |               |
         ====[  ROTOR  ]====  | ← Rotor (star wheel) turns inside housing
              |               |      ↑
              |  [Shaft]------+-----[MOTOR + GEARBOX]  (Drive End)
              |               |
              +-------+-------+
                      |
                   OUTLET
                (Bottom Flange)
                      |
              [Downstream Process]
```

### Component Descriptions

| Component | Description |
|-----------|-------------|
| **Inlet (Top Flange)** | Where bulk material enters from above (hopper, conveyor, silo, etc.) |
| **Outlet (Bottom Flange)** | Where material exits downward into the next process stage |
| **Rotor (Star Wheel)** | Rotating element with multiple pockets/vanes that carry material from inlet to outlet |
| **Shaft** | Connects the rotor to the gearbox and motor |
| **Drive-Side Bearing (DS)** | Bearing on the motor/gearbox side of the shaft |
| **Non-Drive-Side Bearing (NDS)** | Bearing on the opposite end of the shaft |
| **Motor** | Electric motor that drives the rotor (typically AC induction motor) |
| **Gearbox** | Speed reducer between motor and rotor shaft |
| **Housing / Casing** | Outer body that encloses the rotor and forms the pressure seal |
| **End Plates** | Flanged end covers that seal the housing |

### Process Flow

```
1. Material enters the INLET at the top (from hopper, pneumatic conveyor, or silo)
2. Material falls into the ROTOR POCKETS as the rotor turns
3. The ROTOR rotates slowly (typically 5–30 RPM) driven by MOTOR + GEARBOX
4. Filled pockets rotate 180° to the OUTLET position
5. Material falls out of the pocket into the OUTLET at the bottom
6. The empty pocket rotates back to the INLET to receive more material
7. The rotor continuously maintains a PRESSURE SEAL between inlet and outlet zones
```

### Typical Operating Conditions

| Parameter | Typical Range | Notes |
|-----------|--------------|-------|
| Inlet Pressure | 0.5 – 10 bar | Depends on process |
| Material Temperature | 50 – 115 °C | Depends on process |
| Rotor Speed | 5 – 30 RPM | Set by gearbox ratio |
| Motor Power | 0.5 – 15 kW | Depends on size |

### Common Failure Modes

| Failure Mode | Symptom | Sensor to Detect |
|--------------|---------|-----------------|
| **Blockage / Jam** | Rotor stops, motor current spikes, RPM drops to zero | RPM1, ZS1, M1 |
| **Bearing Failure** | High vibration, elevated bearing temperature | BT1, BT2, V1, V2 |
| **Overheating** | High material or bearing temperature | MT1, MT2, BT1, BT2 |
| **Pressure Seal Failure / Leakage** | Abnormal differential pressure, material or gas bypass | P1, P2, DP1 |
| **Rotor Jam (Foreign Object)** | Motor stalls, current overload | RPM1, ZS1, M1 |
| **Motor Overload** | High motor current, thermal trip | M1 |
| **Gearbox Failure** | Vibration, noise, bearing temperature | V1, V2, BT1 |

---

## 4. Sensor Inventory

> **Legend:**
> - **Phase:** Phase 1 = MVP (current) | Phase 2 = Next iteration | Phase 3/4 = Future
> - **Required:** Whether ULTRON software expects this sensor
> - **Installed:** Whether hardware is currently installed

| Tag | Parameter | Location | Sensor Type | Unit | Phase | Required | Installed |
|-----|-----------|----------|-------------|------|-------|----------|-----------|
| **P1** | Inlet Pressure | Inlet duct / inlet flange | 4–20 mA Pressure Transmitter | bar | Phase 1 | ✅ Yes | ❌ No (simulated) |
| **MT2** | Outlet Material Temperature | Outlet duct / outlet flange | 1-Wire DS18B20 or PT100 RTD | °C | Phase 1 | ✅ Yes | ❌ No (simulated) |
| **P2** | Outlet Pressure | Outlet duct / outlet flange | 4–20 mA Pressure Transmitter | bar | Phase 1 optional | Optional | ❌ No |
| **DP1** | Differential Pressure | Across valve (P1 – P2) | Differential Pressure Transmitter | bar | Phase 1 optional | Optional | ❌ No |
| **MT1** | Inlet Material Temperature | Inlet hopper / inlet duct | 1-Wire DS18B20 or PT100 RTD | °C | Phase 1 optional | Optional | ❌ No |
| **BT1** | Drive-Side Bearing Temperature | Drive-side end plate / bearing housing | PT100 RTD or thermocouple | °C | Phase 2 | Future | ❌ No |
| **BT2** | Non-Drive-Side Bearing Temperature | NDS end plate / bearing housing | PT100 RTD or thermocouple | °C | Phase 2 | Future | ❌ No |
| **RPM1** | Rotor Speed | Shaft or gearbox output | Hall-effect proximity sensor or encoder | rpm | Phase 2 | Future | ❌ No |
| **ZS1** | Zero-Speed Detection | Shaft or gearbox output | Zero-speed switch / proximity sensor | status | Phase 2 | Future | ❌ No |
| **V1** | Drive-Side Vibration | Drive-side bearing housing | Industrial accelerometer (IEPE / 4–20 mA) | mm/s | Phase 3 | Future | ❌ No |
| **V2** | Non-Drive-Side Vibration | NDS bearing housing | Industrial accelerometer (IEPE / 4–20 mA) | mm/s | Phase 3 | Future | ❌ No |
| **M1** | Motor Current | Motor control panel / MCC | Current transformer (CT) | A | Phase 2 | Future | ❌ No |

---

## 5. Sensor Mounting Locations

---

### P1 — Inlet Pressure

**Purpose:**
Measure the gas/air pressure at the inlet zone above the rotary valve. This is the higher-pressure side of the airlock. Used to monitor process conditions and detect blockages or abnormal pressure buildup.

**Mounting Location:**
Inlet hopper wall or inlet duct, within 300 mm of the valve inlet flange. Mount on the side wall of the inlet duct, not directly above the material flow path.

**Mechanical Considerations:**
- Use a process isolation valve (ball valve) below the transmitter so it can be removed for maintenance without process shutdown
- Avoid mounting where material buildup could block the sensing port
- Orient with process connection pointing downward or sideways to prevent material ingress

**Wiring Considerations:**
- 4–20 mA two-wire loop-powered transmitter
- 24 VDC loop supply from Raspberry Pi / signal conditioning board
- Maximum loop resistance must be within transmitter spec (typically < 600 Ω)
- Use shielded cable; ground shield at one end only
- Cable run: sensor to Raspberry Pi / ADC

**Expected Operating Range:**
- Process range: 0 – 10 bar
- Recommended transmitter range: 0 – 10 bar or 0 – 16 bar (standard catalog range)

**Recommended Sensor Type:**
Industrial 4–20 mA pressure transmitter
- Process connection: ½" NPT or G¼" male
- Output: 4–20 mA, two-wire
- Examples: Endress+Hauser Cerabar, Siemens SITRANS P, ABB 2600T, Vega VEGABAR
- IP rating: IP65 minimum (IP67 preferred for dusty environment)

**Signal to Raspberry Pi:**
4–20 mA → ADS1115 ADC (via 250 Ω shunt resistor → 1.0 V – 5.0 V)

---

### MT2 — Outlet Material Temperature

**Purpose:**
Measure the temperature of material exiting the valve at the outlet. Used to detect overheating of material (thermal process fault) and as an indicator of frictional heating from a jammed rotor.

**Mounting Location:**
Outlet duct or outlet flange, within 200 mm below the valve outlet. Mount in the material flow path (contact measurement) for material temperature, or on the outer wall of the duct for surface temperature indication.

**Mechanical Considerations:**
- Thermowell recommended if measuring material directly (protects sensor, allows removal without shutdown)
- If using a surface-mount type, ensure good thermal contact with the duct/flange
- Avoid mounting where material can accumulate around the sensor

**Wiring Considerations:**
- 1-Wire DS18B20: single-wire digital protocol, GPIO direct to Raspberry Pi
- Enable 1-Wire overlay in Raspberry Pi config: `dtoverlay=w1-gpio`
- Use 4.7 kΩ pull-up resistor on the data line (required for DS18B20)
- Maximum cable run for 1-Wire: 10–20 m (use stronger pull-up for longer runs)
- Shielded cable recommended in industrial environments

**Expected Operating Range:**
- Process range: 50 – 115 °C (software limits)
- DS18B20 hardware range: −55 °C to +125 °C (suitable)

**Recommended Sensor Type:**
- **Current implementation:** 1-Wire DS18B20 digital temperature sensor (low cost, direct GPIO)
- **Industrial upgrade:** PT100 RTD with 4–20 mA transmitter head (better accuracy, longer cable runs)
- IP rating: IP65 minimum

**Signal to Raspberry Pi:**
DS18B20 → GPIO pin 27 (1-Wire protocol) → reads `/sys/bus/w1/devices/28-*/w1_slave`

---

### P2 — Outlet Pressure

**Purpose:**
Measure pressure at the outlet zone (low-pressure side). Combined with P1, this gives **differential pressure** across the valve — a key indicator of seal integrity and leakage.

**Mounting Location:**
Outlet duct, within 300 mm below the valve outlet flange. Mirror location of P1 on the outlet side.

**Mechanical Considerations:**
Same as P1 — process isolation valve, avoid material buildup at sensing port.

**Wiring Considerations:**
Same as P1 — 4–20 mA two-wire loop, shielded cable.

**Expected Operating Range:**
- Process range: 0 – 2 bar (outlet is typically near atmospheric)
- Recommended transmitter range: 0 – 2.5 bar or 0 – 4 bar

**Recommended Sensor Type:**
Same type as P1 (4–20 mA pressure transmitter) — use a lower range for the outlet side.

**Status:** Phase 1 optional / Unknown — needs verification

---

### DP1 — Differential Pressure

**Purpose:**
Direct measurement of pressure difference between inlet (P1) and outlet (P2). More accurate than calculating P1 – P2 from two separate sensors. Used to detect seal leakage and monitor valve efficiency.

**Mounting Location:**
Can be mounted on a valve manifold connecting both process taps (inlet and outlet).

**Wiring Considerations:**
4–20 mA two-wire loop, shielded cable.

**Expected Operating Range:**
- Differential range: 0 – 10 bar (worst case = max inlet pressure)
- Recommended transmitter range: 0 – 10 bar differential

**Recommended Sensor Type:**
Industrial differential pressure transmitter (4–20 mA)
- Examples: Endress+Hauser Deltabar, Siemens SITRANS P DS III

**Status:** Phase 1 optional / Unknown — needs verification

---

### MT1 — Inlet Material Temperature

**Purpose:**
Measure material temperature at the inlet. Combined with MT2, this detects temperature rise across the valve (indicating frictional heating from rotor drag or partial jam).

**Mounting Location:**
Inlet hopper or inlet duct, near the inlet flange.

**Wiring Considerations:**
Same as MT2.

**Expected Operating Range:**
Same as MT2 (50 – 115 °C operating, wider if process requires).

**Recommended Sensor Type:**
Same as MT2.

**Status:** Phase 1 optional / Unknown — needs verification

---

### BT1 — Drive-Side Bearing Temperature

**Purpose:**
Monitor the temperature of the drive-side (motor side) shaft bearing. Bearing failure is one of the most common causes of rotary valve downtime. A rising temperature trend indicates early bearing degradation.

**Mounting Location:**
Drive-side end plate or bearing housing, as close to the outer bearing race as possible.

**Mechanical Considerations:**
- Use a surface-mount RTD in a drilled and tapped pocket in the bearing housing for best accuracy
- Alternatively, a stick-on PT100 probe with good thermal compound
- Protect from vibration with strain relief on the cable

**Wiring Considerations:**
- PT100 RTD: 3-wire connection to RTD transmitter head or Raspberry Pi RTD module
- Thermocouple (Type K): direct connection to Raspberry Pi thermocouple interface module

**Expected Operating Range:**
- Normal: ambient + 15–40 °C above ambient
- Warning threshold: Unknown / needs verification
- Critical threshold: Unknown / needs verification
- Typical bearing max continuous: 80–100 °C (verify with bearing manufacturer)

**Recommended Sensor Type:**
PT100 RTD surface-mount probe with 4–20 mA transmitter head (industrial grade)

**Status:** Phase 2 / Not yet planned in detail

---

### BT2 — Non-Drive-Side Bearing Temperature

**Purpose:**
Same as BT1 but for the non-drive-side bearing (opposite end of the shaft from the motor).

**Mounting Location:**
Non-drive-side end plate or bearing housing.

**All other considerations:** Same as BT1.

**Status:** Phase 2 / Not yet planned in detail

---

### RPM1 — Rotor Speed

**Purpose:**
Measure the actual rotational speed of the rotor shaft. Used to confirm the rotor is turning at the correct speed and to detect slowdown (indicating overload) or complete stoppage.

**Mounting Location:**
On the shaft or gearbox output coupling. A proximity sensor target (tooth, bolt, or drilled hole) on the shaft flange triggers a pulse per revolution.

**Mechanical Considerations:**
- Requires a metallic target on the rotating shaft (if using inductive proximity sensor)
- Maintain correct sensing gap (typically 1–3 mm for inductive sensors)
- Protect from material contact and vibration

**Wiring Considerations:**
- PNP or NPN proximity sensor output → Raspberry Pi GPIO (pulse counting)
- 3-wire connection: 24 VDC supply, signal, GND
- Pull-up/pull-down resistor on GPIO depending on output type

**Expected Operating Range:**
- Typical valve speed: 5 – 30 RPM
- Pulse frequency at 30 RPM with 1 pulse/rev = 0.5 Hz (easily measurable)

**Recommended Sensor Type:**
Inductive proximity sensor, PNP NO, 24 VDC, M12 housing, IP67
Or: Hall-effect sensor with magnet on shaft

**Status:** Phase 2 / Unknown — needs verification

---

### ZS1 — Zero-Speed Detection

**Purpose:**
Binary indication that the rotor has stopped completely. Simpler and more reliable than RPM1 for shutdown alarms. If ZS1 activates while the machine should be running, it triggers an immediate fault alarm.

**Mounting Location:**
Same as RPM1 — shaft or gearbox output.

**Recommended Sensor Type:**
Dedicated zero-speed switch (e.g., Nortek CS4, Danaher, Jaquet) — these are purpose-built relays that de-energize when rotation stops. Or: use RPM1 logic in software to derive zero-speed condition.

**Status:** Phase 2 / Unknown — needs verification

---

### V1 — Drive-Side Vibration

**Purpose:**
Measure vibration at the drive-side bearing housing. Increasing vibration is an early indicator of bearing wear, rotor imbalance, or misalignment — allowing maintenance to be planned before failure.

**Mounting Location:**
Drive-side bearing housing, radial direction (perpendicular to shaft axis). Stud-mount accelerometer preferred for best frequency response.

**Mechanical Considerations:**
- Stud mount (threaded into bearing housing) gives best results for high-frequency analysis
- Magnet mount is acceptable for occasional measurements
- Ensure mounting surface is clean, flat, and free of paint

**Wiring Considerations:**
- IEPE (Integrated Electronics Piezo-Electric): 4 mA constant current supply, AC-coupled signal
- 4–20 mA vibration transmitter: simpler, direct ADC input
- Industrial accelerometers can output RMS velocity in mm/s directly

**Expected Operating Range:**
- Normal: < 2.8 mm/s RMS (ISO 10816 Class I/II)
- Warning: 2.8 – 7.1 mm/s RMS
- Critical: > 7.1 mm/s RMS
- (Verify against machine-specific baseline)

**Recommended Sensor Type:**
4–20 mA vibration transmitter (outputs RMS velocity in mm/s), IP67
Examples: PCB Piezotronics 604C01, Wilcoxon Research, IMC Networks

**Status:** Phase 3 / Not yet planned in detail

---

### V2 — Non-Drive-Side Vibration

**Purpose:** Same as V1 but for the non-drive-side bearing.
**Mounting Location:** Non-drive-side bearing housing.
**All other considerations:** Same as V1.

**Status:** Phase 3 / Not yet planned in detail

---

### M1 — Motor Current

**Purpose:**
Monitor the electrical current drawn by the drive motor. A rising current indicates increased mechanical load (partial blockage, material buildup). A sudden current spike followed by zero indicates a motor trip or breaker fault.

**Mounting Location:**
Motor Control Centre (MCC) panel or motor terminal box. The current transformer (CT) clamps around one phase conductor.

**Mechanical Considerations:**
- CT must be sized for the motor's full-load current (FLC) — check motor nameplate
- Do not open-circuit a CT secondary while the primary is energised (dangerous voltage)
- Use a burden resistor to convert CT secondary current to a measurable voltage

**Wiring Considerations:**
- CT secondary output → 4–20 mA transmitter → Raspberry Pi / ADC
- Or: CT → burden resistor → ADS1115 ADC (if low current secondary, e.g., 0–50 mA)
- Shielded cable from MCC to Raspberry Pi

**Expected Operating Range:**
- Depends entirely on motor size (Unknown / needs verification)
- Record motor nameplate FLC; set warning at 110%, critical at 125% FLC

**Recommended Sensor Type:**
Split-core current transformer with 4–20 mA transmitter
Examples: Murata SCT series, YHDC SCT-013, industrial CT transmitters

**Status:** Phase 2 / Unknown — needs verification

---

## 6. Hardware Tag Definitions

These are the **exact tag names** used by all ULTRON software components. Hardware must use these names without modification. If a tag name changes, every software component must be updated.

| Tag | Full Name | Parameter | Unit |
|-----|-----------|-----------|------|
| **P1** | Inlet Pressure | Pressure at inlet zone | bar |
| **P2** | Outlet Pressure | Pressure at outlet zone | bar |
| **DP1** | Differential Pressure | P1 minus P2 across valve | bar |
| **MT1** | Inlet Material Temperature | Temperature of material at inlet | °C |
| **MT2** | Outlet Material Temperature | Temperature of material at outlet | °C |
| **BT1** | Drive-Side Bearing Temperature | Shaft bearing temperature, motor side | °C |
| **BT2** | Non-Drive-Side Bearing Temperature | Shaft bearing temperature, far side | °C |
| **RPM1** | Rotor Speed | Rotational speed of valve rotor | rpm |
| **ZS1** | Zero-Speed Detection | Rotor stopped status | status (0/1) |
| **V1** | Drive-Side Vibration | Vibration at drive-side bearing | mm/s RMS |
| **V2** | Non-Drive-Side Vibration | Vibration at NDS bearing | mm/s RMS |
| **M1** | Motor Current | Motor phase current draw | A |

> **Rule:** Tag names are case-sensitive. Use exactly as shown above (e.g., `MT2`, not `mt2` or `Mt2`).

---

## 7. Software Data Expectations

The software expects the following data for each tag. All values must match these specifications exactly.

---

### P1 — Inlet Pressure

| Property | Value |
|----------|-------|
| **Data Type** | Float32 (32-bit floating point) |
| **Unit** | bar |
| **Update Rate** | 100 ms (10 Hz) |
| **Minimum Value** | 4.0 bar |
| **Maximum Value** | 11.0 bar |
| **Normal Range** | 6.0 – 8.0 bar |
| **Warning Threshold** | ≥ 8.8 bar |
| **Critical Threshold** | ≥ 10.45 bar |
| **Decimal Places** | 2 (e.g., 7.35) |
| **Modbus Registers** | 30001 – 30002 (Float32, high word first) |

---

### MT2 — Outlet Material Temperature

| Property | Value |
|----------|-------|
| **Data Type** | Float32 (32-bit floating point) |
| **Unit** | °C (degrees Celsius) |
| **Update Rate** | 100 ms (10 Hz) |
| **Minimum Value** | 50.0 °C |
| **Maximum Value** | 115.0 °C |
| **Normal Range** | 70.0 – 90.0 °C |
| **Warning Threshold** | ≥ 92.0 °C |
| **Critical Threshold** | ≥ 109.25 °C |
| **Decimal Places** | 1 (e.g., 82.1) |
| **Modbus Registers** | 30003 – 30004 (Float32, high word first) |

---

### P2 — Outlet Pressure *(Future)*

| Property | Value |
|----------|-------|
| **Data Type** | Float32 |
| **Unit** | bar |
| **Update Rate** | 100 ms |
| **Expected Range** | Unknown / needs verification |
| **Modbus Registers** | Not yet assigned |

---

### BT1 / BT2 — Bearing Temperatures *(Phase 2)*

| Property | Value |
|----------|-------|
| **Data Type** | Float32 |
| **Unit** | °C |
| **Update Rate** | 1 s (1 Hz) — thermal sensors do not require 10 Hz |
| **Expected Range** | Unknown / needs verification |
| **Modbus Registers** | Not yet assigned |

---

### RPM1 — Rotor Speed *(Phase 2)*

| Property | Value |
|----------|-------|
| **Data Type** | Float32 or UInt16 |
| **Unit** | rpm |
| **Update Rate** | 1 s (1 Hz) |
| **Expected Range** | 0 – 60 rpm (Unknown / needs verification) |
| **Modbus Registers** | Not yet assigned |

---

### V1 / V2 — Vibration *(Phase 3)*

| Property | Value |
|----------|-------|
| **Data Type** | Float32 |
| **Unit** | mm/s (RMS velocity) |
| **Update Rate** | 1 s (1 Hz) for overall RMS; higher for FFT |
| **Expected Range** | 0 – 20 mm/s RMS (Unknown / needs verification) |
| **Modbus Registers** | Not yet assigned |

---

### M1 — Motor Current *(Phase 2)*

| Property | Value |
|----------|-------|
| **Data Type** | Float32 |
| **Unit** | A (Amperes) |
| **Update Rate** | 100 ms |
| **Expected Range** | Unknown / needs verification (depends on motor) |
| **Modbus Registers** | Not yet assigned |

---

## 8. Communication Architecture

### Current Architecture (Phase 1)

```
[P1 Pressure Sensor]          [MT2 Temperature Sensor]
       |                               |
  4–20 mA                         1-Wire Digital
       |                               |
[ADS1115 ADC]             [Raspberry Pi 4 GPIO pin 27]
       |                               |
       +---------------+---------------+
                       |
              [Raspberry Pi 4]
              (ULTRON Backend)
                       |
              [FastAPI on port 8000]
              [Uvicorn ASGI server]
                       |
            +----------+----------+
            |          |          |
       [WebSocket]  [REST API]  [Modbus TCP]
       /ws           /sensors   port 5020
       100 ms       on-demand   on-demand
            |
    [Network — Ethernet or WiFi]
            |
    [ULTRON Desktop App]
    (Tauri + React on Windows PC)
            |
    [Operator Dashboard]
    (Live gauges, trends, alarms)
```

### Future Architecture (Phase 4+)

```
[Industrial Sensors]
       |
[4–20 mA / IEPE / RTD]
       |
[Signal Conditioning Module (UM Card)]
       |
[Modbus RTU — RS485 fieldbus]
       |
[ULTRON Edge Gateway]
(Raspberry Pi 4 or industrial PC)
       |
[Modbus TCP / WebSocket]
       |
[ULTRON Backend]
       |
[ULTRON Desktop / Cloud Dashboard]
```

---

### WebSocket Protocol

**Endpoint:** `ws://<device-ip>:8000/ws`

**Broadcast Interval:** 100 ms (configurable)

**Message Format (JSON):**
```json
{
  "timestamp": "2026-06-02T10:00:00+00:00",
  "pressure": 7.35,
  "temperature": 82.1,
  "status": "healthy"
}
```

**Status Values:**

| Value | Meaning |
|-------|---------|
| `healthy` | All readings within normal range |
| `warning` | Pressure ≥ 8.8 bar OR Temperature ≥ 92.0 °C |
| `critical` | Pressure ≥ 10.45 bar OR Temperature ≥ 109.25 °C |
| `offline` | Sensor unreachable |

---

### Modbus TCP Protocol

**Host:** `<device-ip>`
**Port:** 5020 (development) / 502 (production — requires root on Linux)
**Function Code:** 4 (Read Input Registers)
**Slave ID:** 0 (single-slave mode)

---

### Modbus RTU Protocol

**Interface:** RS485 serial
**Serial Port:** `/dev/ttyUSB0` (Linux) or `COM1–COM4` (Windows)
**Baud Rate:** 9600
**Data Format:** 8N1 (8 data bits, no parity, 1 stop bit)
**Slave ID:** 1

> RS485 hardware is not yet installed. Modbus RTU server is implemented in software but
> untested on physical hardware.

---

### mDNS Auto-Discovery

**Service Name:** `_ultron._tcp.local.`
**Hostname:** `ultron-edge.local`
**Port:** 8000

The ULTRON backend advertises itself on the local network via mDNS (Bonjour / Zeroconf). The desktop application automatically discovers the device without manual IP configuration.

---

## 9. Modbus Register Mapping

### Register Type

All sensor data is stored in **Input Registers** (Function Code 4, Read-Only).

Holding Registers (Function Code 3/6/16, Read/Write) are reserved for future configuration commands.

### Address Convention

Modbus uses two address systems:

| System | Example | Description |
|--------|---------|-------------|
| **Display Address** | 30001 | What you see in Modbus documentation |
| **PDU Address** | 0 | What goes inside the Modbus packet |
| Relationship | Display = PDU + 30001 | — |

> When configuring a Modbus client (SCADA, PLC, HMI): use **Display Addresses**.

---

### Input Register Map

| Display Addr | PDU Addr | Parameter | Data Type | Unit | Description |
|---|---|---|---|---|---|
| **30001–30002** | 0–1 | P1 — Inlet Pressure | Float32 | bar | Two 16-bit registers, high word first (ABCD) |
| **30003–30004** | 2–3 | MT2 — Outlet Temperature | Float32 | °C | Two 16-bit registers, high word first (ABCD) |
| **30005** | 4 | P1 Alarm Status | UInt16 | enum | 0 = Normal, 1 = Warning, 2 = Critical |
| **30006** | 5 | MT2 Alarm Status | UInt16 | enum | 0 = Normal, 1 = Warning, 2 = Critical |
| **30007** | 6 | Device Health | UInt16 | enum | 0 = Fault, 1 = Healthy |
| **30008** | 7 | Sensor Fault Flags | UInt16 | enum | 0 = None, 1 = Pressure, 2 = Temp, 3 = Both |
| **30009–30010** | 8–9 | System Uptime | UInt32 | seconds | High word at 30009 |
| **30011** | 10 | Communication Mode | UInt16 | enum | 1=WS, 2=TCP, 3=RTU, 4=TCP+RTU |
| **30012** | 11 | Heartbeat Counter | UInt16 | count | Increments each update, wraps at 65535 |
| **30101** | 100 | P1 (compatibility) | UInt16 | bar × 100 | 7.35 bar → 735 (for legacy PLCs) |
| **30102** | 101 | MT2 (compatibility) | UInt16 | °C × 100 | 82.45 °C → 8245 (for legacy PLCs) |
| **30201–30206** | 200–205 | Device Signature | UInt16[6] | ASCII | "ULTRON EDGE" packed as ASCII pairs |
| **30211** | 210 | SW Major Version | UInt16 | — | Software version major (e.g., 1) |
| **30212** | 211 | SW Minor Version | UInt16 | — | Software version minor (e.g., 0) |
| **30213** | 212 | SW Patch Version | UInt16 | — | Software version patch (e.g., 0) |
| **30214** | 213 | Device Type Code | UInt16 | enum | 1 = Raspberry Pi Gateway |
| **30215** | 214 | Protocol Capability | UInt16 | bitmap | bit0=WebSocket, bit1=Modbus TCP, bit2=Modbus RTU |

---

### Float32 Encoding

All floating-point values use **two consecutive 16-bit registers** in **big-endian word order (ABCD)**:

```
Register N   = High word  (bytes A, B)
Register N+1 = Low word   (bytes C, D)

Example: 7.35 bar
IEEE 754 Float32: 0x40EB3333
Register 30001 = 0x40EB (high word)
Register 30002 = 0x3333 (low word)
```

**Configuration setting:** `MODBUS_BYTE_ORDER = "ABCD"` (big-endian, default)

> If your PLC or SCADA requires a different byte order (CDAB, BADC, DCBA), change this setting.
> Inform the software team before changing — it affects all Float32 registers simultaneously.

---

### Scaling Rules (Compatibility Registers)

For PLCs that cannot handle Float32, use the compatibility registers (30101, 30102):

```
Pressure:    bar × 100 → stored as UInt16 (range 0–65535)
             Example: 7.35 bar → 735

Temperature: °C × 100 → stored as UInt16 (range 0–65535)
             Example: 82.45 °C → 8245
```

To recover engineering value: **divide register value by 100**.

---

### Future Holding Registers (Reserved)

| Display Addr | PDU Addr | Parameter | Notes |
|---|---|---|---|
| 40001 | 0 | Broadcast Interval | Write to change update rate (ms) |
| 40002 | 1 | Alarm Acknowledge | Write 1 to acknowledge active alarms |
| 40003–40010 | 2–9 | Reserved | Future configuration commands |

> **No holding registers are currently implemented.** This is a reservation for future use.

---

## 10. Hardware Requirements

### Power Supply

| Item | Requirement | Notes |
|------|------------|-------|
| Raspberry Pi 4 | 5 VDC, 3 A (15 W) minimum | Use official RPi 4 PSU or equivalent industrial 5V DIN-rail supply |
| 4–20 mA Loop Supply | 24 VDC, 100 mA per loop | Standard industrial 24 VDC DIN-rail supply |
| RS485 Transceiver | 3.3 VDC or 5 VDC | Powered from RPi or separate 5 VDC rail |
| Sensor Supply | 24 VDC | For proximity sensors (RPM1, ZS1) |

**Recommendation:** Use a dedicated industrial DIN-rail power supply for 24 VDC loops. Do not power sensors from the Raspberry Pi 5 V rail (current limit too low for multiple 4–20 mA loops).

---

### Electrical Isolation

| Interface | Isolation Required? | Recommendation |
|-----------|-------------------|---------------|
| 4–20 mA input | Recommended | Use isolated 4–20 mA receiver or isolated ADC module |
| 1-Wire temperature | Not critical (short cable) | Use only if cable run > 10 m |
| RS485 / Modbus RTU | Yes (strongly recommended) | Use isolated RS485 transceiver |
| Raspberry Pi power | Yes (mains-powered systems) | Use isolated DIN-rail 5 VDC PSU |

**Why isolation matters:** In industrial environments, ground potential differences between equipment can destroy GPIO pins or corrupt data. RS485 in particular requires isolation to prevent ground loops.

---

### Grounding

- All cable shields must be grounded at **one end only** (typically the control panel / Raspberry Pi end)
- Grounding at both ends creates a ground loop and increases noise
- The Raspberry Pi chassis (if metal enclosure) should be connected to the panel earth (PE)
- 4–20 mA loop ground should be at the supply common terminal

---

### Shielding

| Cable Type | Shielding Requirement |
|-----------|----------------------|
| 4–20 mA sensor cables | Shielded (overall braid or foil + drain) |
| 1-Wire temperature | Shielded if cable > 5 m |
| RS485 | Shielded twisted pair (STP) — mandatory |
| Ethernet | Cat5e or Cat6 shielded (STP/FTP) in EMI-heavy environments |

---

### Cable Recommendations

| Signal | Cable Type | Example Part |
|--------|-----------|-------------|
| 4–20 mA (2-wire) | 2-core 0.5 mm² shielded | Belden 8760, Lapp UNITRONIC |
| 4–20 mA (4-wire) | 4-core 0.5 mm² shielded | Belden 9418 |
| 1-Wire | 2-core 0.5 mm² shielded | Standard instrument cable |
| RS485 | Twisted pair shielded (120 Ω characteristic impedance) | Belden 3105A, Alpha Wire 5902 |
| Ethernet | Cat6 STP | Standard network cable |

---

### Environmental Requirements

| Condition | Requirement | Notes |
|-----------|------------|-------|
| Operating Temperature | 0 – 50 °C (Raspberry Pi) | Provide ventilation in enclosure |
| Humidity | 20 – 80% RH non-condensing | Use desiccant if condensation risk |
| IP Rating (Enclosure) | IP54 minimum | IP65 recommended near valve |
| Vibration | Low (control panel location) | Mount RPi away from direct machine vibration |
| Dust | Protected enclosure | Rotary valves handle dusty materials |

---

### EMI Considerations

- Keep 4–20 mA and 1-Wire cables away from high-voltage power cables (minimum 150 mm separation)
- Do not run signal cables parallel to motor cables (use perpendicular crossings where needed)
- Install ferrite cores on cables entering the enclosure if EMI is suspected
- RS485 cable requires 120 Ω termination resistors at both ends of the bus

---

## 11. Raspberry Pi Interface Requirements

### Current GPIO Assignments

| GPIO (BCM) | Signal | Function | Status |
|-----------|--------|---------|--------|
| **GPIO 27** | MT2 | 1-Wire DS18B20 temperature sensor | ✅ Configured in code (stub, not tested on hardware) |
| **GPIO 17** | P1 | Pressure sensor input (reserved) | ⚠️ Reserved in code — actual ADC interface via I2C |

> **Important:** GPIO 17 is reserved as a placeholder in the current code. The actual pressure
> reading will be done via **I2C to ADS1115 ADC**, not a direct GPIO voltage input.
> The hardware driver (`HardwarePressureSensor.read()`) is currently a stub and raises
> `NotImplementedError`. This must be implemented before hardware deployment.

---

### ADC Requirements (for Pressure Sensor)

**For 4–20 mA pressure sensor input:**

| Item | Specification |
|------|--------------|
| ADC Type | ADS1115 (16-bit, 4-channel, I2C) |
| Interface | I2C (SDA: GPIO 2, SCL: GPIO 3 on RPi 4) |
| Input Voltage Range | 0 – 5 V (use 250 Ω shunt: 4 mA → 1 V, 20 mA → 5 V) |
| Resolution | 16-bit → 0.076 mV per step at ±4.096 V range |
| Python Library | `adafruit-circuitpython-ads1x15` |
| I2C Address | 0x48 (default, ADDR pin to GND) |

**Wiring diagram:**
```
24 VDC PSU (+)
      |
  [Pressure Sensor] (4–20 mA output)
      |
    [250 Ω shunt resistor]   ← 1V to 5V across resistor
      |
  ADS1115 AIN0 (positive input)
      |
  ADS1115 GND (negative / common)
      |
24 VDC PSU (-)
```

> The Raspberry Pi's onboard ADC does not exist — an external ADC (ADS1115 or similar) is
> **mandatory** for any analog sensor input.

---

### 1-Wire Requirements (for Temperature Sensor)

| Item | Specification |
|------|--------------|
| Protocol | 1-Wire (Dallas/Maxim) |
| GPIO Pin | GPIO 27 (BCM) |
| Pull-up Resistor | 4.7 kΩ to 3.3 V (mandatory) |
| RPi Config | Add `dtoverlay=w1-gpio` to `/boot/config.txt` (or `/boot/firmware/config.txt` on newer images) |
| Kernel Module | `modprobe w1-gpio; modprobe w1-therm` |
| Data Path | `/sys/bus/w1/devices/28-*/w1_slave` |
| Multiple Sensors | Multiple DS18B20 sensors can share the same 1-Wire bus |

---

### UART / RS485 Requirements

| Item | Specification |
|------|--------------|
| UART Port | `/dev/ttyUSB0` (via USB-RS485 adapter) or `/dev/ttyAMA0` (RPi hardware UART) |
| Baud Rate | 9600 (configurable) |
| RS485 Transceiver | Isolated USB-to-RS485 adapter (recommended for USB) or half-duplex RS485 HAT |
| Termination | 120 Ω at each end of the RS485 bus |
| Example Adapter | Waveshare USB to RS485 converter, FTDI chip |

---

### Ethernet / Network Requirements

| Item | Specification |
|------|--------------|
| Interface | Raspberry Pi 4 Gigabit Ethernet (recommended) |
| WiFi | RPi 4 built-in 2.4/5 GHz WiFi (backup only — use wired for industrial deployment) |
| IP Assignment | Static IP strongly recommended for production deployment |
| Ports Required | TCP 8000 (FastAPI/WebSocket), TCP 5020 (Modbus TCP), UDP 5353 (mDNS) |
| Hostname | `ultron-edge` or `ultron-edge.local` (configurable) |

**Production deployment recommendation:** Use wired Ethernet. WiFi is acceptable for development and demo only.

---

### Recommended HATs / Modules

| Function | Recommended Module | Notes |
|----------|--------------------|-------|
| 4–20 mA ADC | Adafruit ADS1115 breakout board | I2C, 4-channel, 16-bit |
| RS485 | Waveshare RS485 CAN HAT or USB-RS485 adapter | Isolated variant preferred |
| Relay Output | RPi Relay Board (future alarms output) | Optional, Phase 4+ |
| RTC | DS3231 RTC HAT | For accurate timestamps without NTP |
| Enclosure | DIN-rail or panel-mount industrial enclosure | IP54 or IP65 |

---

### Raspberry Pi 4 Pinout Reference (Relevant Pins)

```
RPi 4 40-pin Header (relevant signals only):

Pin 1  = 3.3 VDC (pull-up supply for 1-Wire)
Pin 2  = 5 VDC (ADS1115 power supply)
Pin 3  = GPIO 2 / I2C SDA  → ADS1115 SDA
Pin 4  = 5 VDC
Pin 5  = GPIO 3 / I2C SCL  → ADS1115 SCL
Pin 6  = GND
Pin 13 = GPIO 27 / 1-Wire  → DS18B20 data line (+ 4.7kΩ to pin 1)
Pin 11 = GPIO 17            → Reserved (P1 placeholder)
Pin 14 = GND
```

---

## 12. Future Expansion Roadmap

### Phase 2 — Enhanced Machine Monitoring

**Target:** Deeper mechanical health monitoring

| Addition | Tag | Technology |
|----------|-----|-----------|
| Drive-Side Bearing Temperature | BT1 | PT100 RTD + 4–20 mA transmitter |
| NDS Bearing Temperature | BT2 | PT100 RTD + 4–20 mA transmitter |
| Rotor Speed | RPM1 | Inductive proximity sensor + pulse counting |
| Zero-Speed Detection | ZS1 | Zero-speed switch or RPM1 derived |
| Motor Current | M1 | Current transformer + 4–20 mA transmitter |
| Outlet Pressure | P2 | 4–20 mA pressure transmitter |

**Software changes required:**
- Add new sensor tags to data model
- Add new Modbus registers
- Add bearing temperature gauges to dashboard
- Add RPM and current trend charts

---

### Phase 3 — Predictive Maintenance

**Target:** FFT vibration analysis, machine health scoring

| Addition | Tag | Technology |
|----------|-----|-----------|
| Drive-Side Vibration | V1 | 4–20 mA vibration transmitter (RMS) or IEPE accelerometer |
| NDS Vibration | V2 | Same as V1 |
| FFT Analysis | — | IEPE accelerometer + high-speed ADC |

**Software changes required:**
- Vibration FFT processing on Raspberry Pi
- Bearing fault frequency detection (BPFI, BPFO, BSF, FTF)
- Machine Health Score incorporating vibration
- Trend-based maintenance scheduling

---

### Phase 4 — Multi-Machine and Gateway Architecture

**Target:** Support multiple machines and external instrumentation systems

| Addition | Description |
|----------|-------------|
| **UM Card** | Universal measurement card — multi-channel ADC with signal conditioning |
| **TP Card** | Temperature and process card — dedicated RTD/thermocouple inputs |
| **Wireless Sensor Nodes** | Battery-powered IoT nodes for remote or rotating measurements |
| **Industrial Gateway** | Dedicated gateway device running ULTRON Edge (not Raspberry Pi) |
| **Multi-Machine Dashboard** | Multiple machines visible in single ULTRON instance |
| **Cloud Integration** | Data upload to ULTRON Cloud for remote monitoring |

**Modbus expansion:**
- Each machine gets its own Modbus slave ID
- Gateway handles multiple slave IDs
- ULTRON backend handles multiple simultaneous Modbus connections

---

## 13. Hardware–Software Contract

This section defines the binding agreement between the Hardware Team and the Software Team.

**The following must not change without a written change request reviewed by both teams.**

---

### Tag Names Are Fixed

| Rule | Detail |
|------|--------|
| Tag names are permanent | Once a tag is active in production, its name cannot change |
| Current active tags | P1, MT2 |
| Change process | Any rename requires updating: models.py, sensorPoints.ts, register_map.py, Modbus documentation, this document |

---

### Units Are Fixed

| Tag | Unit | Locked |
|-----|------|--------|
| P1 | bar | ✅ Locked |
| MT2 | °C | ✅ Locked |
| P2 | bar | Locked when activated |
| BT1, BT2 | °C | Locked when activated |
| RPM1 | rpm | Locked when activated |
| V1, V2 | mm/s | Locked when activated |
| M1 | A | Locked when activated |

**Do not change bar to kPa or PSI without notifying the software team.** All frontend displays, alarm thresholds, and Modbus scaling are calibrated to the above units.

---

### Modbus Register Map Is Fixed

| Rule | Detail |
|------|--------|
| Register addresses are permanent | Do not renumber existing registers |
| Float32 byte order default | ABCD (big-endian) — change requires explicit agreement |
| New sensors | Add new registers at the next available address — never overwrite existing |
| Change process | Any register change requires updating register_map.py and notifying all Modbus clients |

---

### Update Rate Expectation

| Signal | Minimum Update Rate |
|--------|-------------------|
| P1 pressure | 10 Hz (every 100 ms) |
| MT2 temperature | 10 Hz (every 100 ms) |
| Bearing temperatures (future) | 1 Hz |
| Vibration RMS (future) | 1 Hz |
| RPM (future) | 1 Hz |

The software WebSocket stream broadcasts every 100 ms. If a sensor cannot update at 10 Hz, the last known value is repeated — this is acceptable. However, the physical sensor must produce a new reading at least every 1 second for process monitoring to be meaningful.

---

### What Happens When Hardware Changes

| Hardware Change | Impact on Software | Required Action |
|----------------|-------------------|-----------------|
| Change sensor type (e.g., DS18B20 → PT100) | No impact if signal type to RPi is unchanged | None (if 1-Wire to 1-Wire or ADC to ADC) |
| Change signal type (e.g., 1-Wire → 4–20 mA) | Software driver must be updated | Update `HardwarePressureSensor` or `HardwareTemperatureSensor` |
| Change pressure sensor range (e.g., 0–10 bar → 0–25 bar) | ADC scaling changes; alarm thresholds may need review | Update `config.py` scaling, review alarm limits, test |
| Add a new sensor (e.g., BT1) | New tag, new Modbus register, new dashboard element | Full software change required — plan in advance |
| Change Modbus RTU baud rate | Modbus RTU server config must match | Update `.env` `MODBUS_RTU_BAUDRATE` |
| Change RS485 cable topology | No software impact | Inform software team for documentation update |

---

## 14. Open Hardware Questions

| # | Question | Status |
|---|----------|--------|
| 1 | Final pressure sensor model and manufacturer? | ❓ Unknown / needs verification |
| 2 | Final pressure sensor range (0–10 bar, 0–16 bar, other)? | ❓ Unknown / needs verification |
| 3 | Final temperature sensor type (DS18B20 or PT100 RTD)? | ❓ Unknown / needs verification |
| 4 | ADC selection confirmed (ADS1115 or alternative)? | ❓ Unknown / needs verification |
| 5 | Electrical isolation strategy for 4–20 mA inputs? | ❓ Unknown / needs verification |
| 6 | RS485 transceiver selection (USB adapter or HAT)? | ❓ Unknown / needs verification |
| 7 | Power supply architecture (single 24 VDC + RPi 5 VDC, or UPS-backed)? | ❓ Unknown / needs verification |
| 8 | Enclosure type, IP rating, and mounting location for Raspberry Pi? | ❓ Unknown / needs verification |
| 9 | Cable routing and cable lengths from sensors to panel? | ❓ Unknown / needs verification |
| 10 | Does the process require process isolation valves on pressure sensors? | ❓ Unknown / needs verification |
| 11 | Is the pressure sensor wetted by process material (requires food-grade or corrosion-resistant material)? | ❓ Unknown / needs verification |
| 12 | What is the process material (powder, granules)? Any material safety data to consider? | ❓ Unknown / needs verification |
| 13 | Is Modbus RTU required for Phase 1, or is WebSocket + Modbus TCP sufficient? | ❓ Unknown / needs verification |
| 14 | Network infrastructure at deployment site (Ethernet available, or WiFi only)? | ❓ Unknown / needs verification |
| 15 | Target operating temperature at deployment location (affects RPi thermal management)? | ❓ Unknown / needs verification |

---

## 15. Hardware Team Action Items

### Phase 1 — MVP Completion

- [ ] Select and order pressure transmitter (P1) — confirm range and signal type
- [ ] Select and order temperature sensor (MT2) — confirm DS18B20 or PT100
- [ ] Confirm ADC module selection (ADS1115 recommended)
- [ ] Confirm RS485 transceiver selection (isolated USB-RS485 or HAT)
- [ ] Define physical mounting locations for P1 and MT2 on the valve
- [ ] Confirm process isolation strategy for pressure sensor
- [ ] Confirm signal type: 4–20 mA for pressure, 1-Wire for temperature
- [ ] Confirm cable types and lengths for all sensor runs
- [ ] Confirm power supply architecture (24 VDC loop supply + 5 VDC for RPi)
- [ ] Confirm enclosure selection and mounting location
- [ ] Create wiring diagram (sensor to terminal block to RPi/ADC)
- [ ] Create initial Bill of Materials (BOM)
- [ ] Install and wire sensors on valve
- [ ] Commission Raspberry Pi with ULTRON backend
- [ ] Verify sensor readings in ULTRON dashboard (compare to reference instrument)
- [ ] Review wiring and installation with software team before sign-off

### Phase 2 — Preparation

- [ ] Identify bearing temperature sensor locations (BT1, BT2)
- [ ] Identify RPM sensor mounting location (RPM1)
- [ ] Specify motor current transformer requirements (M1)
- [ ] Reserve Modbus register space for Phase 2 tags
- [ ] Document Phase 2 sensor specs and signal types
- [ ] Review Phase 2 hardware additions with software team before ordering

### Documentation

- [ ] Update this document when hardware decisions are made
- [ ] Update this document when sensors are physically installed
- [ ] Mark "Installed" column in Section 4 when each sensor is commissioned
- [ ] Record as-built cable numbers and lengths

---

*End of HARDWARE.md*

---

> **Document Control**
> Any changes to this document must be reviewed by both the Hardware Team and Software Team.
> Tag names, units, and Modbus register assignments in this document are the contract between hardware and software.
