# UI_UX.md
## ULTRON — UI/UX Design System

**Purpose:** Single source of truth for all UI design decisions. Locked decisions are marked. Do not deviate from locked decisions without updating [DECISIONS.md](DECISIONS.md).
**Last Updated:** 2026-06-02
**Audience:** Frontend developers, designers, AI agents

> Cross-references: [SOFTWARE.md](SOFTWARE.md) | [PROCESS_OVERVIEW.md](PROCESS_OVERVIEW.md) | [DECISIONS.md](DECISIONS.md)

---

## CRITICAL: Locked Design Decision

> **Option 3 SCADA Dark Theme is LOCKED.**
>
> The navy-steel dark palette was selected and locked as the official ULTRON visual identity.
> This is a final decision. Do not change background colors, panel colors, accent colors,
> or the overall dark industrial aesthetic without explicit approval and a DECISIONS.md entry.
>
> See [DECISIONS.md — UI Style Decision](DECISIONS.md).

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing and Sizing](#4-spacing-and-sizing)
5. [Dashboard Layout](#5-dashboard-layout)
6. [Component Guidelines](#6-component-guidelines)
7. [Alarm Design](#7-alarm-design)
8. [Trend Chart Design](#8-trend-chart-design)
9. [Process Overview Design](#9-process-overview-design)
10. [Navigation Design](#10-navigation-design)
11. [Responsive Rules](#11-responsive-rules)
12. [Theme Architecture](#12-theme-architecture)
13. [Future UI Roadmap](#13-future-ui-roadmap)

---

## 1. Design Philosophy

ULTRON uses an **industrial SCADA aesthetic** — not a consumer app aesthetic.

| Principle | Implementation |
|-----------|---------------|
| **Clarity first** | Every pixel communicates data; no decorative elements |
| **Dark by default** | Dark theme primary — reduces eye strain in control room / plant environments |
| **Color = meaning** | Green = normal, Amber = warning, Red = critical — always |
| **Information density** | High density; operators need to see everything at once |
| **No unnecessary animation** | Subtle transitions only; no attention-grabbing effects |
| **Fixed viewport** | Dashboard fits one screen — no scrolling for primary data |

---

## 2. Color System

### CSS Variables (Dark Mode — Locked)

All colors are defined as CSS variables in `ultron-desktop/src/index.css`.

```css
:root {
  /* ── Surfaces ─────────────────────────────────────── */
  --surface:     #060C18;  /* Page background — deep ocean navy */
  --panel:       #0C1A28;  /* Panel background — dark steel */
  --panel-alt:   #122233;  /* Panel header — slightly raised */
  --sidebar:     #040810;  /* Sidebar — near-black navy */

  /* ── Borders ──────────────────────────────────────── */
  --border:      #1A3048;  /* Standard panel border */
  --border-hi:   #2A4A6A;  /* Highlighted border (hover, active) */

  /* ── Text ─────────────────────────────────────────── */
  --text:        #CDE4F8;  /* Primary text — bright cool white */
  --text-2:      #6AAED0;  /* Secondary text — steel blue */
  --text-3:      #3A5E7A;  /* Tertiary / subdued */

  /* ── Accent ───────────────────────────────────────── */
  --accent:      #38A0FF;  /* Electric blue — active state, links */

  /* ── Status ───────────────────────────────────────── */
  --ok:          #20D068;  /* Vivid green — healthy / normal */
  --warn:        #FFB020;  /* Golden amber — warning */
  --crit:        #FF4040;  /* Vivid red — critical / fault */
}
```

### ECharts Colors (from `constants.ts`)

```typescript
pressure: {
  color:     '#38bdf8',     // Sky blue — pressure line
  colorWarn: '#ffb830',     // Amber — pressure warning
  colorCrit: '#ff2d55',     // Red — pressure critical
  areaColor: 'rgba(56,189,248,0.18)',
},
temperature: {
  color:     '#a78bfa',     // Purple — temperature line
  colorWarn: '#ffb830',     // Amber — temperature warning
  colorCrit: '#ff2d55',     // Red — temperature critical
  areaColor: 'rgba(167,139,250,0.18)',
},
```

### Status Color Mapping

| Status | Color Variable | Hex | Use |
|--------|---------------|-----|-----|
| Healthy / Normal | `--ok` | `#20D068` | Gauge, status badge, sensor dot |
| Warning | `--warn` | `#FFB020` | Gauge warning zone, alarm row, sensor dot |
| Critical | `--crit` | `#FF4040` | Gauge critical zone, alarm row, sensor dot |
| Offline / Unknown | `--text-3` | `#3A5E7A` | Uninstalled sensors, disconnected state |
| Connected / Active | `--accent` | `#38A0FF` | Connection indicator |

### Rule: Never Hardcode Colors in Components

All color references in components must use CSS variables or the named constants from `constants.ts`. Direct hex values in `.tsx` files are prohibited.

---

## 3. Typography

### Font

- **Primary font:** System font stack (Tailwind default) — no external font loading
- Rationale: fast rendering, no network dependency, consistent on Windows/Linux

### Type Scale

Tailwind CSS is customized in `tailwind.config.js`:

```javascript
fontSize: {
  'xs':  ['0.65rem',  { lineHeight: '1rem' }],      // labels, small metadata
  'sm':  ['0.75rem',  { lineHeight: '1.125rem' }],   // secondary text
  'base':['0.825rem', { lineHeight: '1.25rem' }],    // body text
  'lg':  ['0.925rem', { lineHeight: '1.375rem' }],   // card titles
  'xl':  ['1.05rem',  { lineHeight: '1.5rem' }],     // section titles
  '2xl': ['1.25rem',  { lineHeight: '1.75rem' }],    // page titles
}
```

> Font sizes are intentionally small — ULTRON targets high-density industrial displays (1920×1080+).
> This was a deliberate sizing decision. Do not increase base font size without testing at target resolution.

### Type Roles

| Role | Class | Description |
|------|-------|-------------|
| Gauge value | `text-2xl font-bold` | Large readable metric |
| Card title | `text-xs font-semibold uppercase tracking-wider` | Section header |
| Metadata | `text-xs text-[--text-2]` | Secondary information |
| Status label | `text-xs font-medium` | WARN / CRIT labels |
| Body text | `text-sm` | Paragraphs, descriptions |

---

## 4. Spacing and Sizing

### Panel Padding

- Internal panel content: `p-3` or `p-4` (12–16 px)
- Panel header: `px-4 py-2` (horizontal 16 px, vertical 8 px)
- Gap between top-row cards: `gap-3` (12 px)

### Fixed Heights

| Element | Height |
|---------|--------|
| TopBar | 48 px |
| Sidebar (expanded) | 220 px width |
| Sidebar (collapsed) | 56 px width |
| Dashboard row 1 (cards) | ~180 px fixed |
| Dashboard row 2 | `flex: 1` — fills remaining viewport height |

### Breakpoints

ULTRON currently targets **desktop only** (1366×768 minimum, 1920×1080 primary).
Mobile responsive design is **not yet implemented** — future roadmap.

---

## 5. Dashboard Layout

### Overview Mode

```
┌──────────────────────────────────────────────────────────────────┐
│ SIDEBAR (56px collapsed / 220px expanded)                        │
│                                                                  │
│  ┌─ TopBar ─────────────────────────────────────────────────┐   │
│  │ Connection status  │  App name  │  Clock  │  Theme toggle │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Row 1 (fixed ~180px) ───────────────────────────────────┐   │
│  │  ┌─ PressureCard ─┐  ┌─ TemperatureCard ─┐  ┌─ Health ─┐│   │
│  │  │  Gauge         │  │  Gauge             │  │  Donut   ││   │
│  │  │  Range bar     │  │  Range bar         │  │  Score   ││   │
│  │  │  WARN/CRIT     │  │  WARN/CRIT         │  │          ││   │
│  │  └────────────────┘  └────────────────────┘  └──────────┘│   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Row 2 (flex-1, fills height) ──────────────────────────┐   │
│  │  ┌─ ProcessOverview (2/3) ─────────┐  ┌─ MultiTrend ─┐  │   │
│  │  │  Rotary Airlock Valve SVG       │  │  Dual-axis   │  │   │
│  │  │  with sensor dots               │  │  pressure +  │  │   │
│  │  │  Click → fullscreen             │  │  temperature │  │   │
│  │  └─────────────────────────────────┘  └──────────────┘  │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Key Layout Rules

1. **No scroll** — all primary data visible without scrolling
2. **Row 2 fills remaining height** — `flex: 1`, `min-h-0`
3. **ProcessOverview: 2/3 width** — `flex: 2`
4. **MultiTrendChart: 1/3 width** — `flex: 1`
5. Charts use `ResizeObserver` — never fixed pixel heights

### Simulation Banner

When `mode === 'simulated'`, a yellow banner appears at the top of the dashboard content area:

```
⚠  SIMULATION MODE — No hardware connected. Displaying synthetic data.
```

---

## 6. Component Guidelines

### Panel Component (`Panel.tsx`)

Base wrapper for all dashboard panels.

```
┌─ panel-alt (header bg) ──────────────────────────────┐
│  Icon + Title                         [actions]       │
├─ border ──────────────────────────────────────────────┤
│                                                       │
│  panel (body bg) — content area                       │
│                                                       │
└───────────────────────────────────────────────────────┘
```

- Header: `bg-[--panel-alt]` with `border-b border-[--border]`
- Body: `bg-[--panel]`
- Border: `border border-[--border] rounded-lg`

### Gauge Cards (`PressureCard`, `TemperatureCard`)

```
┌─────────────────────────────────────────┐
│  P1 — INLET PRESSURE                    │
├─────────────────────────────────────────┤
│                                         │
│        [ECharts Gauge]                  │
│           7.35                          │
│            bar                          │
│                                         │
│  [=======================|==]  (range bar)
│  MIN    NORMAL    WARN  CRIT  MAX       │
└─────────────────────────────────────────┘
```

- Gauge color reflects status: green/amber/red
- Range bar shows current value position relative to min/max/warn/crit
- WARN and CRIT threshold labels shown on range bar

### Health Score Card (`HealthScoreCard`)

- Donut gauge: 0–100
- Color: green (> 70), amber (40–70), red (< 40)
- Label: "MACHINE HEALTH"
- Score: large number in center

### Status Badge (`StatusBadge`)

```
● CONNECTED     ← green dot + text
● CONNECTING    ← amber blinking dot
● DISCONNECTED  ← red dot
```

---

## 7. Alarm Design

### Alarm States

| State | Color | Visual |
|-------|-------|--------|
| No alarms | — | AlarmPanel shows "No active alarms" |
| Warning | `--warn` (#FFB020) | Amber row with amber tag |
| Critical | `--crit` (#FF4040) | Red row with red tag |

### Alarm Panel Row

```
┌─────────────────────────────────────────────────────┐
│ [●] HIGH PRESSURE     10:05:23   7.35 bar   [ACK]   │
└─────────────────────────────────────────────────────┘
```

- Dot color: amber (warning) or red (critical)
- Shows: alarm name, timestamp, triggering value
- ACK button: acknowledges alarm (removes from active list)

### TopBar Alarm Badge

- Hidden when no alarms
- Amber count badge for warnings
- Red count badge for criticals
- Clicking badge navigates to Alarms view

---

## 8. Trend Chart Design

### MultiTrendChart (Primary)

Dual-axis ECharts line chart showing pressure and temperature over time.

```
bar ↑ (left Y-axis)           °C ↑ (right Y-axis)
     │                              │
8.8  │-------- WARN ────────────────│─────── 92.0
     │                              │
7.0  │ ~~~pressure~~~               │ ~~~temperature~~~
     │                              │
 ────┴──────────────────────────────┴───→ time
```

- Left Y-axis: pressure (bar) — sky blue line
- Right Y-axis: temperature (°C) — purple line
- Warning threshold lines (dashed amber)
- Critical threshold lines (dashed red)
- Last 1000 readings (MAX_HISTORY=1000)
- Chart redraws every 200 ms (CHART_FPS_MS=200)
- ResizeObserver handles container resize

### ECharts Configuration Rules

- Background: `transparent` (panel provides background)
- Grid line color: `--border` (#1A3048)
- Axis label color: `--text-2` (#6AAED0)
- Tooltip: dark background, no border
- Legend: top center, below chart title
- Smooth lines: `smooth: true`
- Area fill: subtle gradient using areaColor constants

---

## 9. Process Overview Design

See [PROCESS_OVERVIEW.md](PROCESS_OVERVIEW.md) for complete digital twin documentation.

### Panel Layout

```
┌─ PROCESS OVERVIEW ──────────────────[fullscreen icon]─┐
│                                                        │
│   [RotaryAirlockValveSvg]                             │
│   (fills container, preserves aspect ratio)            │
│                                                        │
│   Sensor dots overlaid on SVG                         │
│   Click dot → SensorDetailPanel appears                │
│   Click fullscreen → modal overlay, SVG fills screen  │
└────────────────────────────────────────────────────────┘
```

### Sensor Dot Colors

| Status | Color |
|--------|-------|
| `normal` (installed, healthy) | `--ok` green |
| `warning` | `--warn` amber |
| `alarm` (critical) | `--crit` red |
| `not_installed` | `--text-3` grey/subdued |

### Fullscreen Behavior

- Clicking the fullscreen button expands the SVG to cover the entire viewport
- SVG `fillContainer` prop is set to `true` in fullscreen mode
- Press `Esc` or click outside to exit fullscreen
- This was a Phase 9 feature, implemented in `ProcessOverview.tsx`

---

## 10. Navigation Design

### Sidebar

```
┌──────────────────┐  Expanded (220px)
│ [≡] ULTRON       │
├──────────────────┤
│ ○ Overview       │  ← active
│ ○ Trends         │
│ ○ Alarms      ●3 │  ← alarm badge
│ ─────────────    │
│ ○ Monitoring     │
│ ○ Devices        │
│ ○ Diagnostics    │
│ ─────────────    │
│ ○ Maintenance    │
│ ○ Reports        │
│ ○ Settings       │
└──────────────────┘

┌────┐  Collapsed (56px)
│ ≡  │
├────┤
│ ○  │
│ ○  │
│ ○  │
└────┘
```

- Collapse toggle at top
- Active view highlighted with `--accent` blue left border + accent text
- Alarm badge shown on Alarms nav item when active alarms exist
- Sidebar background: `--sidebar` (#040810)
- Transition: smooth width animation

### TopBar

```
┌─ TopBar ────────────────────────────────────────────────────────┐
│  [ULTRON logo/name]   ●CONNECTED RPi4-ULTRON-001   [clock]  ☀  │
└─────────────────────────────────────────────────────────────────┘
```

- Connection status indicator with device ID
- Real-time clock
- Theme toggle (sun/moon icon)
- Height: 48 px, `bg-[--sidebar]`

---

## 11. Responsive Rules

| Rule | Current |
|------|---------|
| Target resolution | 1366×768 minimum, 1920×1080 primary |
| Mobile support | ❌ Not implemented — future roadmap |
| Tablet support | ❌ Not implemented — future roadmap |
| Fixed sidebar | 220px expanded, 56px collapsed |
| Chart sizing | Responsive via ResizeObserver — no fixed heights |
| Font sizes | Tailwind custom scale (see §3) — small for density |

> When implementing mobile support in future, the entire layout needs redesign.
> Do not attempt partial mobile CSS without a planned responsive architecture.

---

## 12. Theme Architecture

### How It Works

1. `ThemeContext.tsx` provides `{ isDark, toggle }` via React context
2. Theme is stored in `localStorage` as `'dark'` or `'light'`
3. JavaScript applies `dark` or `light` class to `<html>` element
4. CSS variables are overridden in `html.light { ... }` block
5. All component colors use CSS variables — they automatically switch

### Dark Theme (Primary — Locked)

Active by default. Class: none (default variables in `:root`)

### Light Theme (Secondary)

Lighter palette for bright environments. Class: `html.light`

> Light theme is secondary and may not be as polished as dark theme.
> Dark theme is always the reference and is tested first.

---

## 13. Future UI Roadmap

| Feature | Phase | Description |
|---------|-------|-------------|
| Bearing temperature gauges | Phase 2 | BT1, BT2 cards in dashboard |
| RPM gauge | Phase 2 | Rotor speed card |
| Motor current gauge | Phase 2 | M1 card |
| Vibration cards | Phase 3 | V1, V2 RMS gauges |
| FFT spectrum chart | Phase 3 | Frequency domain vibration |
| Machine Health Score improvements | Phase 3 | Multi-sensor health algorithm |
| Multi-machine selector | Phase 4 | Switch between machines |
| Machine fleet overview | Phase 5 | Grid of all machines status |
| Mobile layout | Future | Responsive redesign for tablets/phones |
| Dark/light theme polish | Future | Full light theme parity with dark |
| User preferences | Phase 3 | Per-user settings, alarm subscriptions |
| Export / reporting | Phase 4 | PDF reports, CSV export |
