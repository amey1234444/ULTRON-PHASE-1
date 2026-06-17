# MACHINES.md
## ULTRON — Machine Library

**Purpose:** Document every machine type that ULTRON supports or plans to support.
**Last Updated:** 2026-06-02
**Audience:** Hardware engineers, software engineers, product team

> Cross-references: [SENSORS.md](SENSORS.md) | [HARDWARE.md](HARDWARE.md) | [ROADMAP.md](ROADMAP.md)

---

## Currently Supported

| Machine | Phase | Status | Digital Twin |
|---------|-------|--------|-------------|
| Rotary Airlock Valve | Phase 1 | ✅ Active | ✅ SVG complete |

## Planned Machines

| Machine | Phase | Status |
|---------|-------|--------|
| Kiln | Future | ❌ Not started |
| Conveyor | Future | ❌ Not started |
| Compressor | Future | ❌ Not started |
| Centrifugal Pump | Future | ❌ Not started |
| Fan / Blower | Future | ❌ Not started |
| Crusher | Future | ❌ Not started |
| Electric Motor | Future | ❌ Not started |

---

## Machine 1 — Rotary Airlock Valve (RAV)

### Description

A Rotary Airlock Valve (also called a rotary feeder or star feeder) transfers dry bulk solids between process zones while maintaining an airlock (pressure seal) between them. It is widely used in pneumatic conveying, dust collection, cement, food processing, and chemical industries.

### Digital Twin

- **Status:** ✅ Complete (Phase 1)
- **File:** `ultron-desktop/src/components/process/RotaryAirlockValveSvg.tsx`
- **SVG viewBox:** `900 × 560`
- **Sensor dots:** 11 positioned sensor points
- See [PROCESS_OVERVIEW.md](PROCESS_OVERVIEW.md) for full SVG documentation

### Key Components

| Component | Function |
|-----------|---------|
| Inlet flange (top) | Material entry point |
| Outlet flange (bottom) | Material discharge |
| Rotor (star wheel) | Carries material in pockets; creates pressure seal |
| Shaft | Connects rotor to gearbox |
| Drive-side bearing | Supports shaft on motor/gearbox end |
| Non-drive-side bearing | Supports shaft on opposite end |
| Gearbox | Speed reduction between motor and rotor |
| Motor | Electric drive (AC induction, typically) |
| End plates | Seal the housing |

### Process Flow

```
Material enters INLET (top)
    ↓
Falls into ROTOR POCKETS
    ↓
Rotor turns (5–30 RPM)
    ↓
Pockets rotate 180° to OUTLET
    ↓
Material falls out OUTLET (bottom)
    ↓
Empty pocket returns to INLET
```

### Common Failure Modes

| Failure | Cause | Detection Method |
|---------|-------|-----------------|
| Rotor jam | Foreign object, oversized material, material buildup | RPM1 drop, M1 current spike, ZS1 trip |
| Bearing failure | Wear, contamination, lubrication loss | BT1/BT2 temperature rise, V1/V2 vibration increase |
| Pressure seal leakage | Worn rotor tips, damaged end plates | DP1 differential pressure deviation |
| Material overheating | High inlet temp, friction from jam | MT1/MT2 temperature rise |
| Motor overload | Rotor drag, blockage | M1 current > FLC |
| Gearbox failure | Oil loss, worn gears | V1 vibration, BT1 temperature |

### Recommended Sensor Suite (Full)

| Tag | Parameter | Priority | Phase |
|-----|-----------|---------|-------|
| P1 | Inlet Pressure | Critical | Phase 1 ✅ |
| MT2 | Outlet Material Temperature | Critical | Phase 1 ✅ |
| P2 | Outlet Pressure | High | Phase 1 optional |
| DP1 | Differential Pressure | High | Phase 1 optional |
| MT1 | Inlet Material Temperature | Medium | Phase 1 optional |
| BT1 | Drive-Side Bearing Temperature | High | Phase 2 |
| BT2 | NDS Bearing Temperature | High | Phase 2 |
| RPM1 | Rotor Speed | High | Phase 2 |
| ZS1 | Zero-Speed | High | Phase 2 |
| M1 | Motor Current | Medium | Phase 2 |
| V1 | Drive-Side Vibration | Medium | Phase 3 |
| V2 | NDS Vibration | Medium | Phase 3 |

### Recommended KPIs

| KPI | Calculation | Normal Range |
|-----|------------|-------------|
| Differential Pressure (DP) | P1 − P2 | Stable at expected setpoint |
| Seal Efficiency | Actual DP / Rated DP × 100 | > 90% |
| Bearing Health | BT1 / BT2 vs. baseline | < baseline + 20 °C |
| Rotor Speed Stability | RPM1 variance | < ±5% of setpoint |
| Motor Load | M1 / Motor FLC × 100 | < 85% continuously |

### Alarm Recommendations

| Alarm | Condition | Severity |
|-------|-----------|---------|
| High Inlet Pressure | P1 ≥ 8.8 bar | Warning |
| Critical Inlet Pressure | P1 ≥ 10.45 bar | Critical |
| High Temperature | MT2 ≥ 92 °C | Warning |
| Critical Temperature | MT2 ≥ 109 °C | Critical |
| Bearing Overtemperature (Phase 2) | BT1 or BT2 ≥ setpoint | Warning/Critical |
| Zero Speed (Phase 2) | ZS1 = 1 while running | Critical |
| Motor Overload (Phase 2) | M1 ≥ 110% FLC | Warning |
| High Vibration (Phase 3) | V1 or V2 ≥ 7.1 mm/s | Warning |

### Predictive Maintenance Opportunities

| Technique | Sensor | What It Detects |
|-----------|--------|----------------|
| Bearing temperature trend | BT1, BT2 | Early bearing degradation — temperature rises weeks before failure |
| Vibration spectrum (FFT) | V1, V2 | Bearing fault frequencies (BPFI, BPFO, BSF, FTF) |
| Rotor speed deviation | RPM1 | Gradual gearbox wear — speed becomes unstable |
| Motor current signature | M1 | Rotor mechanical faults detectable in current waveform |
| Pressure trend | P1, P2, DP1 | Seal wear — DP slowly decreases as rotor tips wear |

---

## Machine 2 — Kiln (Planned)

### Description

A rotary kiln is a continuous thermal processing device used to heat bulk solids to high temperatures (calcination, combustion, drying). Common in cement, lime, and mineral processing.

### Key Monitoring Parameters (Future)

| Parameter | Sensor Type | Priority |
|-----------|------------|---------|
| Shell temperature (multiple zones) | Infrared pyrometer / thermocouple | Critical |
| Inlet/outlet temperature | Thermocouple | Critical |
| Rotation speed (RPM) | Proximity sensor / encoder | High |
| Drive motor current | CT | High |
| Support roller vibration | Accelerometer | Medium |
| Thrust bearing temperature | RTD | High |
| Feed rate | Load cell / flow meter | Medium |

### Common Failure Modes (Future)

- Hot spot / brick failure (shell overheating)
- Support roller misalignment
- Thrust bearing failure
- Drive motor overload
- Refractory damage

**Status:** Unknown / needs verification — future phase

---

## Machine 3 — Conveyor (Planned)

### Description

Belt or screw conveyor for bulk material transport.

### Key Monitoring Parameters (Future)

| Parameter | Sensor Type |
|-----------|------------|
| Belt speed / slip | Tachometer / zero-speed switch |
| Belt tension | Load cell |
| Drive motor current | CT |
| Drive bearing temperature | RTD |
| Material temperature | Thermocouple |
| Belt alignment | Proximity switch |

**Status:** Unknown / needs verification — future phase

---

## Machine 4 — Compressor (Planned)

### Description

Reciprocating or centrifugal gas compressor.

### Key Monitoring Parameters (Future)

| Parameter | Sensor Type |
|-----------|------------|
| Suction pressure | Pressure transmitter |
| Discharge pressure | Pressure transmitter |
| Differential pressure | DP transmitter |
| Suction temperature | Thermocouple / RTD |
| Discharge temperature | Thermocouple / RTD |
| Vibration | Accelerometer |
| Motor current | CT |
| Bearing temperatures | RTD |
| Oil pressure / temperature | Pressure + temp transmitter |

**Status:** Unknown / needs verification — future phase

---

## Machine 5 — Centrifugal Pump (Planned)

### Description

Centrifugal pump for liquid transfer.

### Key Monitoring Parameters (Future)

| Parameter | Sensor Type |
|-----------|------------|
| Suction pressure | Pressure transmitter |
| Discharge pressure | Pressure transmitter |
| Differential pressure | Calculated P2 − P1 |
| Flow rate | Flow meter |
| Motor current | CT |
| Bearing temperature | RTD |
| Vibration | Accelerometer |
| Shaft seal leakage | Proximity / conductivity |

**Status:** Unknown / needs verification — future phase

---

## Machine 6 — Fan / Blower (Planned)

### Description

Centrifugal fan or positive-displacement blower for air/gas movement.

### Key Monitoring Parameters (Future)

| Parameter | Sensor Type |
|-----------|------------|
| Inlet / outlet pressure | Pressure transmitter |
| Differential pressure | DP transmitter |
| Shaft speed | Tachometer |
| Motor current | CT |
| Bearing temperature | RTD |
| Vibration | Accelerometer |

**Status:** Unknown / needs verification — future phase

---

## Machine 7 — Crusher (Planned)

### Description

Jaw, cone, or impact crusher for size reduction.

### Key Monitoring Parameters (Future)

| Parameter | Sensor Type |
|-----------|------------|
| Motor current | CT |
| Main bearing temperature | RTD |
| Eccentric shaft speed | Tachometer |
| Vibration | Accelerometer |
| Feed level | Ultrasonic level sensor |
| Product temperature | Thermocouple |

**Status:** Unknown / needs verification — future phase

---

## Machine 8 — Electric Motor (Planned)

### Description

Standalone electric motor monitoring (can be applied to any driven machine).

### Key Monitoring Parameters (Future)

| Parameter | Sensor Type |
|-----------|------------|
| Stator winding temperature | Embedded PT100 |
| Drive-end bearing temperature | RTD |
| Non-drive-end bearing temperature | RTD |
| Vibration (both ends) | Accelerometer |
| Motor current (all 3 phases) | CT per phase |
| Shaft speed | Tachometer |
| Insulation resistance | Insulation monitor |

**Status:** Unknown / needs verification — future phase

---

## Adding a New Machine to ULTRON

When a new machine type is added, the following must be completed:

### Software Checklist

- [ ] Define sensor tags in `sensorPoints.ts`
- [ ] Create SVG digital twin component
- [ ] Add machine to machine selector in UI (future multi-machine)
- [ ] Define alarm thresholds in `constants.ts`
- [ ] Update Modbus register map for new tags
- [ ] Update [MODBUS.md](MODBUS.md) and [HARDWARE.md](HARDWARE.md)

### Documentation Checklist

- [ ] Add machine section to this file (MACHINES.md)
- [ ] Add sensor entries to [SENSORS.md](SENSORS.md)
- [ ] Update [HARDWARE.md](HARDWARE.md) sensor inventory
- [ ] Update [ROADMAP.md](ROADMAP.md) if phase changes
- [ ] Record decision in [DECISIONS.md](DECISIONS.md)
