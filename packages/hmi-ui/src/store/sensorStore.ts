import { create } from 'zustand';
import type { SensorReading, ConnectionStatus, AlarmState } from '../types/sensor';
import type { DataProtocol } from '../services/device/ConnectionTypes';
import { MAX_HISTORY } from '../config/constants';
import { computeHealthScore } from '../utils/formatters';
import { useThresholdStore } from './thresholdStore';
import { useAlarmStore } from './alarmStore';
import type { AlarmEvent } from './alarmStore';
import { useToastStore } from './toastStore';

// ── Alarm metadata ─────────────────────────────────────────────────────────────

type AlarmKey = keyof AlarmState;

const ALARM_META: Record<AlarmKey, { label: string; tag: string; severity: 'warning' | 'critical'; isPressure: boolean }> = {
  llPressure:    { label: 'Pressure Low-Low',     tag: 'PRS-LL', severity: 'critical', isPressure: true  },
  lPressure:     { label: 'Pressure Low',          tag: 'PRS-L',  severity: 'warning',  isPressure: true  },
  hPressure:     { label: 'Pressure High',         tag: 'PRS-H',  severity: 'warning',  isPressure: true  },
  hhPressure:    { label: 'Pressure High-High',    tag: 'PRS-HH', severity: 'critical', isPressure: true  },
  llTemperature: { label: 'Temperature Low-Low',   tag: 'TMP-LL', severity: 'critical', isPressure: false },
  lTemperature:  { label: 'Temperature Low',       tag: 'TMP-L',  severity: 'warning',  isPressure: false },
  hTemperature:  { label: 'Temperature High',      tag: 'TMP-H',  severity: 'warning',  isPressure: false },
  hhTemperature: { label: 'Temperature High-High', tag: 'TMP-HH', severity: 'critical', isPressure: false },
};

// ── Store ──────────────────────────────────────────────────────────────────────

interface SensorStore {
  readings:           SensorReading[];
  latest:             SensorReading | null;
  healthScore:        number;
  connectionStatus:   ConnectionStatus;
  connectedAt:        number | null;
  reconnectCount:     number;
  alarms:             AlarmState;
  latencyMs:          number;
  activeDataProtocol: DataProtocol;
  /** Per-device reading history, keyed by machine_id (bridge routing). */
  byDevice:           Record<string, SensorReading[]>;
  /** When set, only readings with this machine_id drive the active view. */
  activeMachineId:    string | null;

  addReading:           (r: SensorReading, latencyMs?: number, protocol?: DataProtocol) => void;
  setConnectionStatus:  (s: ConnectionStatus)  => void;
  setActiveProtocol:    (p: DataProtocol)       => void;
  setActiveDevice:      (machineId: string | null) => void;
  incrementReconnect:   ()                      => void;
  reset:                ()                      => void;
}

const defaultAlarms: AlarmState = {
  llPressure:    false,
  lPressure:     false,
  hPressure:     false,
  hhPressure:    false,
  llTemperature: false,
  lTemperature:  false,
  hTemperature:  false,
  hhTemperature: false,
};

/** Pure alarm evaluation against the current thresholds (no side effects). */
function computeAlarms(reading: SensorReading): AlarmState {
  const pt = useThresholdStore.getState().pressure;
  const tt = useThresholdStore.getState().temperature;
  const t = reading.temperature;
  return {
    llPressure:    reading.pressure <= pt.ll,
    lPressure:     reading.pressure <= pt.l && reading.pressure > pt.ll,
    hPressure:     reading.pressure >= pt.h  && reading.pressure < pt.hh,
    hhPressure:    reading.pressure >= pt.hh,
    llTemperature: t !== null && t <= tt.ll,
    lTemperature:  t !== null && t <= tt.l && t > tt.ll,
    hTemperature:  t !== null && t >= tt.h  && t < tt.hh,
    hhTemperature: t !== null && t >= tt.hh,
  };
}

export const useSensorStore = create<SensorStore>((set) => ({
  readings:           [],
  latest:             null,
  healthScore:        100,
  connectionStatus:   'disconnected',
  connectedAt:        null,
  reconnectCount:     0,
  alarms:             { ...defaultAlarms },
  latencyMs:          0,
  activeDataProtocol: 'none',
  byDevice:           {},
  activeMachineId:    null,

  addReading: (reading, latencyMs, protocol) =>
    set((state) => {
      if (reading.source !== 'bridge') {
        return {};
      }

      // Bucket every reading by its machine_id so each device keeps its own
      // history regardless of which device is currently being viewed.
      let byDevice = state.byDevice;
      const mid = reading.machine_id;
      if (mid) {
        const prev = state.byDevice[mid] ?? [];
        const bucket = prev.length >= MAX_HISTORY
          ? [...prev.slice(-(MAX_HISTORY - 1)), reading]
          : [...prev, reading];
        byDevice = { ...state.byDevice, [mid]: bucket };
      }

      // When a device is selected, only its readings drive the active view.
      // When none is selected, fall back to the legacy global behavior so the
      // simulator / single-device setups keep working unchanged.
      if (state.activeMachineId !== null && mid !== state.activeMachineId) {
        return { byDevice };
      }

      const next = state.readings.length >= MAX_HISTORY
        ? [...state.readings.slice(-(MAX_HISTORY - 1)), reading]
        : [...state.readings, reading];

      const t = reading.temperature;
      const newAlarms: AlarmState = computeAlarms(reading);

      // Detect alarm state transitions and emit events + toasts
      const prevAlarms  = state.alarms;
      const alarmStore  = useAlarmStore.getState();
      const toastStore  = useToastStore.getState();

      (Object.keys(newAlarms) as AlarmKey[]).forEach((key) => {
        const fired    = newAlarms[key];
        const wasFired = prevAlarms[key];
        if (fired === wasFired) return;

        const meta  = ALARM_META[key];
        const value = meta.isPressure
          ? `${reading.pressure.toFixed(2)} bar`
          : `${(t ?? 0).toFixed(1)} °C`;

        if (fired) {
          const event: AlarmEvent = {
            id: `${key}-${reading.timestamp}`,
            alarmId: key, label: meta.label, tag: meta.tag,
            severity: meta.severity, value,
            firedAt: reading.timestamp, clearedAt: null,
          };
          alarmStore.recordFired(event);
          toastStore.push(`${meta.label}: ${value}`, meta.severity);
        } else {
          alarmStore.recordCleared(key, reading.timestamp);
        }
      });

      return {
        readings:           next,
        latest:             reading,
        alarms:             newAlarms,
        healthScore:        computeHealthScore(reading.pressure, t),
        latencyMs:          latencyMs ?? state.latencyMs,
        activeDataProtocol: protocol  ?? state.activeDataProtocol,
        byDevice,
      };
    }),

  setConnectionStatus: (connectionStatus) =>
    set((state) => ({
      connectionStatus,
      connectedAt: connectionStatus === 'connected' ? Date.now() : state.connectedAt,
    })),

  setActiveProtocol: (activeDataProtocol) => set({ activeDataProtocol }),

  setActiveDevice: (machineId) =>
    set((state) => {
      if (machineId === state.activeMachineId) return {};
      // Rehydrate the active view from the selected device's bucket.
      const bucket = machineId ? (state.byDevice[machineId] ?? []) : state.readings;
      const latest = bucket.length ? bucket[bucket.length - 1] : null;
      return {
        activeMachineId: machineId,
        readings: machineId ? bucket : state.readings,
        latest: machineId ? latest : state.latest,
        alarms: latest ? computeAlarms(latest) : { ...defaultAlarms },
        healthScore: latest ? computeHealthScore(latest.pressure, latest.temperature) : 100,
      };
    }),

  incrementReconnect: () =>
    set((state) => ({ reconnectCount: state.reconnectCount + 1 })),

  reset: () =>
    set({
      readings: [], latest: null, healthScore: 100,
      connectionStatus: 'disconnected', connectedAt: null,
      reconnectCount: 0, alarms: { ...defaultAlarms },
      latencyMs: 0, activeDataProtocol: 'none',
      byDevice: {}, activeMachineId: null,
    }),
}));
