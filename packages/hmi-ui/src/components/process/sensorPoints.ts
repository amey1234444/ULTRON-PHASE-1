import type { SensorPhase, CalloutSide, SensorPoint, SensorStatus } from './types';
import type { SensorReading } from '../../types/sensor';
import { getSensorStatus } from '../../utils/formatters';

// ── Static metadata (positions + descriptions) ────────────────────────────────

interface SensorMeta {
  tag:         string;
  name:        string;
  unit:        string;
  installed:   boolean;
  phase:       SensorPhase;
  location:    string;
  description: string;
  dotX:        number;
  dotY:        number;
  calloutX:    number;
  calloutY:    number;
  calloutSide: CalloutSide;
}

const SENSOR_META: SensorMeta[] = [
  // ── Right-side callouts (top → bottom) ──────────────────────────────────────
  {
    tag: 'P1', name: 'Inlet Pressure', unit: 'bar',
    installed: true, phase: 'phase1',
    location: 'Inlet duct / hopper pressure tap',
    description: 'High-side pressure point for differential pressure calculation and inlet blockage detection.',
    dotX: 374, dotY: 95, calloutX: 8, calloutY: 48, calloutSide: 'left',
  },
  {
    tag: 'MT1', name: 'Inlet Material Temp', unit: '°C',
    installed: false, phase: 'phase1',
    location: 'Inlet stream / hopper throat',
    description: 'Material temperature entering the valve. Phase 1 optional.',
    dotX: 466, dotY: 78, calloutX: 732, calloutY: 30, calloutSide: 'right',
  },
  {
    tag: 'BT1', name: 'DS Bearing Temp', unit: '°C',
    installed: false, phase: 'phase2',
    location: 'Drive-side bearing housing',
    description: 'Drive-side bearing temperature. Detects overheating before bearing failure.',
    dotX: 514, dotY: 252, calloutX: 732, calloutY: 104, calloutSide: 'right',
  },
  {
    tag: 'V1', name: 'DS Vibration', unit: 'mm/s',
    installed: false, phase: 'future',
    location: 'Drive-side bearing housing',
    description: 'Drive-side vibration. Detects bearing and rotor mechanical faults.',
    dotX: 514, dotY: 265, calloutX: 732, calloutY: 178, calloutSide: 'right',
  },
  {
    tag: 'RPM1', name: 'Rotor Speed', unit: 'rpm',
    installed: false, phase: 'future',
    location: 'Rotor shaft / coupling',
    description: 'Rotor RPM. Measures actual shaft speed for process control.',
    dotX: 566, dotY: 252, calloutX: 732, calloutY: 252, calloutSide: 'right',
  },
  {
    tag: 'ZS1', name: 'Zero-Speed Sensor', unit: 'status',
    installed: false, phase: 'future',
    location: 'Rotor shaft / coupling',
    description: 'Detects stopped shaft or underspeed condition. Safety interlock.',
    dotX: 566, dotY: 265, calloutX: 732, calloutY: 326, calloutSide: 'right',
  },
  {
    tag: 'M1', name: 'Motor Current', unit: 'A',
    installed: false, phase: 'future',
    location: 'CT in MCC / control panel',
    description: 'Motor supply current via CT in MCC panel. Detects overload and jamming.',
    dotX: 666, dotY: 252, calloutX: 732, calloutY: 400, calloutSide: 'right',
  },
  {
    tag: 'P2', name: 'Outlet Pressure', unit: 'bar',
    installed: false, phase: 'phase1',
    location: 'Outlet duct / discharge pressure tap',
    description: 'Low-side pressure. Used for differential pressure. Planned if available.',
    dotX: 466, dotY: 412, calloutX: 732, calloutY: 474, calloutSide: 'right',
  },
  // ── Left-side callouts ───────────────────────────────────────────────────────
  {
    tag: 'BT2', name: 'NDS Bearing Temp', unit: '°C',
    installed: false, phase: 'phase2',
    location: 'Non-drive-side bearing housing',
    description: 'Non-drive-side bearing temperature. Detects overheating.',
    dotX: 290, dotY: 252, calloutX: 8, calloutY: 205, calloutSide: 'left',
  },
  {
    tag: 'V2', name: 'NDS Vibration', unit: 'mm/s',
    installed: false, phase: 'future',
    location: 'Non-drive-side bearing housing',
    description: 'Non-drive-side vibration. Detects bearing and rotor mechanical faults.',
    dotX: 290, dotY: 265, calloutX: 8, calloutY: 279, calloutSide: 'left',
  },
  {
    tag: 'MT2', name: 'Outlet Material Temp', unit: '°C',
    installed: true, phase: 'phase1',
    location: 'Outlet stream / discharge chute',
    description: 'Material temperature after the valve. Phase 1 primary temperature measurement.',
    dotX: 374, dotY: 428, calloutX: 8, calloutY: 416, calloutSide: 'left',
  },
];

// ── Merge live data from sensorStore into sensor points ───────────────────────

function mapStatus(systemStatus: string): SensorStatus {
  if (systemStatus === 'critical') return 'alarm';
  if (systemStatus === 'warning')  return 'warning';
  return 'normal';
}

export function buildSensorPoints(latest: SensorReading | null): SensorPoint[] {
  return SENSOR_META.map((meta): SensorPoint => {
    if (!meta.installed) {
      return { ...meta, value: null, status: 'not_installed' };
    }

    // P1 → live pressure
    if (meta.tag === 'P1' && latest) {
      return {
        ...meta,
        value: latest.pressure,
        status: mapStatus(getSensorStatus('pressure', latest.pressure)),
      };
    }

    // MT2 → live temperature (may be null when DS18B20 not connected)
    if (meta.tag === 'MT2' && latest) {
      return {
        ...meta,
        value: latest.temperature,
        status: latest.temperature !== null
          ? mapStatus(getSensorStatus('temperature', latest.temperature))
          : 'normal',
      };
    }

    // Installed but no current reading yet
    return { ...meta, value: null, status: 'normal' };
  });
}
