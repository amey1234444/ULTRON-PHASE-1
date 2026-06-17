# PROCESS_OVERVIEW.md
## ULTRON — Digital Twin Documentation

**Purpose:** Document the Rotary Airlock Valve digital twin SVG — architecture, sensor placement, coordinate system, interaction model, and future expansion standards.
**Last Updated:** 2026-06-02
**Audience:** Frontend developers, UI designers, hardware engineers

> Cross-references: [UI_UX.md](UI_UX.md) | [SENSORS.md](SENSORS.md) | [HARDWARE.md](HARDWARE.md) | [SOFTWARE.md](SOFTWARE.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [SVG Architecture](#2-svg-architecture)
3. [Sensor Points System](#3-sensor-points-system)
4. [All 11 Sensor Points](#4-all-11-sensor-points)
5. [Coordinate System](#5-coordinate-system)
6. [Sensor Interaction Model](#6-sensor-interaction-model)
7. [Status and Color Rules](#7-status-and-color-rules)
8. [Fullscreen Behavior](#8-fullscreen-behavior)
9. [Theme Behavior](#9-theme-behavior)
10. [Responsive Behavior](#10-responsive-behavior)
11. [Adding Sensor Points](#11-adding-sensor-points)
12. [Future Machine SVG Standards](#12-future-machine-svg-standards)

---

## 1. Overview

The **Process Overview** is a live interactive digital twin of the monitored machine. For Phase 1, this is the **Rotary Airlock Valve (RAV-01)**.

It shows:
- A schematic SVG diagram of the machine
- Sensor dots positioned at each sensor location
- Live values on dots for installed sensors
- Color-coded status (green/amber/red)
- Click-to-detail interaction for each sensor
- Click-to-fullscreen expansion

### Files

| File | Purpose |
|------|---------|
| `ultron-desktop/src/components/process/RotaryAirlockValveSvg.tsx` | Full SVG machine diagram |
| `ultron-desktop/src/components/process/sensorPoints.ts` | Sensor metadata + data merge function |
| `ultron-desktop/src/components/process/types.ts` | TypeScript types: SensorPoint, SensorStatus, SensorPhase |
| `ultron-desktop/src/components/process/SensorDetailPanel.tsx` | Click-to-detail overlay panel |
| `ultron-desktop/src/components/panels/ProcessOverview.tsx` | Container panel with fullscreen toggle |

---

## 2. SVG Architecture

### SVG Dimensions

```typescript
viewBox="0 0 900 560"      // Design canvas
width="100%"               // Fills container
height="100%"              // Fills container
preserveAspectRatio="xMidYMid meet"  // Maintains aspect ratio
```

### SVG Structure

```
<svg viewBox="0 0 900 560">
  <!-- Machine body layers -->
  <g id="machine-body">
    <!-- Housing, end plates, mounting flanges -->
  </g>
  
  <g id="material-flow">
    <!-- Inlet hopper, outlet chute, flow arrows -->
  </g>
  
  <g id="drive-train">
    <!-- Motor, gearbox, shaft coupling -->
  </g>
  
  <g id="rotor">
    <!-- Rotor star wheel (animated in future) -->
  </g>
  
  <!-- Sensor overlays (rendered by React, not SVG) -->
  <!-- Sensor dots + callout lines + labels -->
  {sensorPoints.map(sp => <SensorDot key={sp.tag} {...sp} />)}
</svg>
```

### `fillContainer` Prop

`RotaryAirlockValveSvg` accepts a `fillContainer?: boolean` prop:
- `false` (default): SVG uses `viewBox` dimensions with `meet` aspect ratio
- `true` (fullscreen): SVG fills the container with `xMidYMid meet`, maximising size

---

## 3. Sensor Points System

### Data Architecture

Sensor data flows through three layers:

```
1. STATIC METADATA (sensorPoints.ts)
   Tag, name, unit, phase, location, description
   SVG dot coordinates (dotX, dotY)
   Callout coordinates (calloutX, calloutY, calloutSide)

2. LIVE DATA (sensorStore.ts)
   latest.pressure → P1
   latest.temperature → MT2
   All others → null

3. MERGED SENSOR POINTS (buildSensorPoints function)
   Combines static metadata with live data
   Computes status from current value
   Returns SensorPoint[] consumed by SVG
```

### TypeScript Types

```typescript
// types.ts
type SensorStatus = 'normal' | 'warning' | 'alarm' | 'not_installed';
type SensorPhase  = 'phase1' | 'phase2' | 'future';
type CalloutSide  = 'left' | 'right';

interface SensorPoint {
  tag:          string;           // 'P1', 'MT2', etc.
  name:         string;           // 'Inlet Pressure'
  unit:         string;           // 'bar', '°C', etc.
  value:        number | string | null;  // live value or null
  status:       SensorStatus;
  installed:    boolean;
  phase:        SensorPhase;
  location:     string;           // physical location text
  description:  string;           // tooltip / detail text
  dotX:         number;           // SVG x-coordinate of sensor dot
  dotY:         number;           // SVG y-coordinate of sensor dot
  calloutX:     number;           // SVG x-coordinate of label callout
  calloutY:     number;           // SVG y-coordinate of label callout
  calloutSide:  CalloutSide;      // which side the callout is on
}
```

### `buildSensorPoints` Function

```typescript
// sensorPoints.ts
export function buildSensorPoints(latest: SensorReading | null): SensorPoint[]
```

Called every render with the latest reading from `sensorStore`. Returns 11 `SensorPoint` objects with live values merged in.

Live data mapping:
- `P1` → `latest.pressure` (bar)
- `MT2` → `latest.temperature` (°C)
- All other tags → `null` (not_installed)

---

## 4. All 11 Sensor Points

### Sensor Point Positions (SVG Coordinate System: 900×560)

| Tag | Name | dotX | dotY | calloutX | calloutY | Side | Installed | Phase |
|-----|------|------|------|----------|----------|------|-----------|-------|
| **P1** | Inlet Pressure | 374 | 95 | 732 | 48 | right | ✅ | Phase 1 |
| **MT1** | Inlet Material Temp | 466 | 78 | 732 | 100 | right | ❌ | Phase 1 opt |
| **BT1** | DS Bearing Temp | 514 | 252 | 732 | 196 | right | ❌ | Phase 2 |
| **V1** | DS Vibration | 514 | 265 | 732 | 248 | right | ❌ | Future |
| **RPM1** | Rotor Speed | 566 | 252 | 732 | 300 | right | ❌ | Future |
| **ZS1** | Zero-Speed Sensor | 566 | 265 | 732 | 352 | right | ❌ | Future |
| **M1** | Motor Current | 666 | 252 | 732 | 404 | right | ❌ | Future |
| **P2** | Outlet Pressure | 466 | 412 | 732 | 456 | right | ❌ | Phase 1 opt |
| **BT2** | NDS Bearing Temp | 290 | 252 | 8 | 205 | left | ❌ | Phase 2 |
| **V2** | NDS Vibration | 290 | 265 | 8 | 257 | left | ❌ | Future |
| **MT2** | Outlet Material Temp | 374 | 428 | 8 | 416 | left | ✅ | Phase 1 |

### Callout Layout Strategy

Sensors are grouped into two callout columns:

**Right side (calloutSide: 'right'):** P1, MT1, BT1, V1, RPM1, ZS1, M1, P2
- All callout labels anchored at x=732, distributed vertically
- Useful for sensors on the motor/drive side and top/outlet of machine

**Left side (calloutSide: 'left'):** BT2, V2, MT2
- All callout labels anchored at x=8, distributed vertically
- Useful for sensors on the non-drive side and outlet/bottom

---

## 5. Coordinate System

The SVG uses a standard Cartesian coordinate system with the origin at the top-left corner:

```
(0,0) ─────────────────────────────── (900,0)
  │                                       │
  │    Rotary Airlock Valve diagram        │
  │                                       │
  │    TOP = Inlet (material enters)      │
  │    CENTER = Rotor / Shaft             │
  │    BOTTOM = Outlet (material exits)   │
  │    RIGHT = Drive side (motor)         │
  │    LEFT = Non-drive side              │
  │                                       │
(0,560) ─────────────────────────────── (900,560)
```

### Machine Zones (Approximate)

| Zone | Y range | X range |
|------|---------|---------|
| Inlet / top flange | 0 – 130 | 300 – 600 |
| Bearing housing (both ends) | 200 – 300 | 250 – 550 |
| Motor + gearbox (drive side) | 200 – 300 | 550 – 800 |
| Outlet / bottom flange | 380 – 490 | 300 – 600 |
| Shaft center | ~252 | ~430 (center) |

---

## 6. Sensor Interaction Model

### Sensor Dot

Each sensor is represented by a circular dot at `(dotX, dotY)`:
- Filled circle with status color
- Small animation (pulse) on critical status
- Hover: cursor pointer
- Click: opens `SensorDetailPanel`

### Callout Line

A line from `(dotX, dotY)` to `(calloutX, calloutY)` with label:
- Right side: line extends right to callout area
- Left side: line extends left to callout area
- Label shows: tag name + value + unit (for installed sensors)
- Label shows: tag name + "NOT INSTALLED" (for uninstalled sensors)

### SensorDetailPanel

Appears on click, positioned absolutely within the ProcessOverview container:

```
┌───────────────────────────────────────┐
│  P1 — INLET PRESSURE              [×] │
├───────────────────────────────────────┤
│  Value:      7.35 bar                 │
│  Status:     ● NORMAL                 │
│  Phase:      Phase 1                  │
│  Location:   Inlet duct / hopper      │
│  Description: High-side pressure...   │
└───────────────────────────────────────┘
```

- Positioned near the clicked sensor dot, adjusted to stay within viewport
- Closes on: clicking `×`, clicking elsewhere, pressing `Esc`
- One detail panel open at a time

---

## 7. Status and Color Rules

| Status | Dot Color | Callout Color | Machine Glow |
|--------|-----------|--------------|-------------|
| `normal` (installed) | `--ok` (#20D068 green) | `--ok` | None |
| `warning` | `--warn` (#FFB020 amber) | `--warn` | Subtle amber glow on nearby structure |
| `alarm` (critical) | `--crit` (#FF4040 red) | `--crit` | Red glow on nearby structure |
| `not_installed` | `--text-3` (#3A5E7A grey) | `--text-3` dimmed | None |

### Phase Indicator

Uninstalled sensors show their phase:
- `phase1` label: "Phase 1 – Not installed"
- `phase2` label: "Phase 2 – Planned"
- `future` label: "Future expansion"

---

## 8. Fullscreen Behavior

Implemented in `ProcessOverview.tsx`:

1. Fullscreen button in panel header (expand icon)
2. Click → sets `isFullscreen = true`
3. Panel renders as a fixed-position overlay covering entire viewport (`z-50`)
4. `RotaryAirlockValveSvg` receives `fillContainer={true}`
5. SVG scales to fill the overlay while preserving aspect ratio
6. `SensorDetailPanel` still works in fullscreen
7. Exit: fullscreen close button, `Esc` key, or clicking outside the SVG

---

## 9. Theme Behavior

The SVG respects the dark/light theme via CSS variables:

| Element | Dark Theme | Light Theme |
|---------|-----------|-------------|
| Machine body fill | Dark steel blue | Lighter steel |
| Machine border stroke | `--border-hi` | Adjusted |
| Sensor dot (normal) | `--ok` | Same |
| Label text | `--text` | Dark text |
| Callout line | `--border-hi` | Dark border |

> Machine body colors are defined inside `RotaryAirlockValveSvg.tsx` using CSS variable references.
> Do not hardcode hex colors in the SVG — use `var(--surface)`, `var(--panel)`, etc.

---

## 10. Responsive Behavior

The ProcessOverview panel is **responsive** by virtue of:
- SVG `width="100%"` `height="100%"`
- `preserveAspectRatio="xMidYMid meet"` — scales proportionally
- Container is `flex: 2` in dashboard row 2
- No fixed pixel sizes in the SVG itself

However:
- Sensor callout label font sizes are defined in SVG units (scale with SVG)
- At very small sizes (< 400 px wide), labels may overlap — this is acceptable for now
- Mobile layout is not yet designed

---

## 11. Adding Sensor Points

To add a new sensor to the digital twin when Phase 2 hardware is installed:

### Step 1 — Update `sensorPoints.ts`

Change `installed: false` to `installed: true` for the relevant tag.

```typescript
{
  tag: 'BT1', name: 'DS Bearing Temp', unit: '°C',
  installed: true,            // ← change this
  phase: 'phase2',
  ...
}
```

### Step 2 — Update `buildSensorPoints` function

Add the data mapping for the new tag:

```typescript
if (meta.tag === 'BT1' && latest) {
  return {
    ...meta,
    value: latest.bearing_temp_ds,    // ← new field in SensorReading
    status: mapStatus(getSensorStatus('bearing', latest.bearing_temp_ds)),
  };
}
```

### Step 3 — Update Backend

Add the new field to `SensorReading` in `ultron-backend/app/models.py` and update `sensor_manager.py` to read it.

### Step 4 — Update `constants.ts`

Add threshold limits for the new sensor type.

### Step 5 — Adjust SVG Dot Position (if needed)

If the dot position needs adjustment after hardware installation, update `dotX` and `dotY` in `SENSOR_META`.

---

## 12. Future Machine SVG Standards

When new machine types are added (Phase 4+), each must follow these standards:

### SVG Requirements

| Requirement | Value |
|-------------|-------|
| ViewBox | 900 × 560 (or justified alternative) |
| File location | `src/components/process/<MachineName>Svg.tsx` |
| Props | `fillContainer?: boolean` |
| Colors | Must use CSS variables only — no hardcoded hex |
| Sensor dots | Rendered by React (not baked into SVG) |
| Layer structure | Separate `<g>` elements for machine, flow, drive, rotor, sensors |

### Sensor Point File

Each machine gets its own `<MachineName>SensorPoints.ts` with:
- SENSOR_META array
- `buildSensorPoints(latest)` export function

### Documentation

Each new machine SVG must be documented in this file (PROCESS_OVERVIEW.md) with:
- SVG dimensions and structure
- Sensor point coordinates table
- Coordinate system explanation
- Interaction model description
