import { create } from 'zustand';
import { DEFAULT_MACHINE_ID } from '../services/device/DeviceIdentity';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectionProtocol = 'lan' | 'wifi' | 'manual' | 'simulation';

export interface ConnectionConfig {
  apiBase:    string;
  wsUrl:      string;
  deviceName: string;
  deviceIp:   string;
  deviceType: string;
  machineId:  string;   // "RAV-01" — the monitored machine
  protocol:   ConnectionProtocol;
  modbusPort: number;
  version:    string;
  lastSeen:   number;
}

interface ConnectionStore {
  config:          ConnectionConfig | null;
  setConfig:       (cfg: ConnectionConfig) => void;
  enterSimulation: ()                      => void;
  clearConfig:     ()                      => void;
}

const ENV_API_BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE
  ? import.meta.env.VITE_API_BASE
  : 'http://localhost:8000';

const ENV_WS_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL
  ? import.meta.env.VITE_WS_URL
  : ENV_API_BASE.replace(/^http/, 'ws') + '/ws';

export const SIMULATION_CONFIG: ConnectionConfig = {
  apiBase:    ENV_API_BASE,
  wsUrl:      ENV_WS_URL,
  deviceName: 'ULTRON Edge (Simulated)',
  deviceIp:   'localhost',
  deviceType: 'simulation',
  machineId:  DEFAULT_MACHINE_ID,
  protocol:   'simulation',
  modbusPort: 5020,
  version:    '1.0.0',
  lastSeen:   0,
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useConnectionStore = create<ConnectionStore>((set) => ({
  config: null,

  setConfig: (config) => set({ config }),

  enterSimulation: () =>
    set({ config: { ...SIMULATION_CONFIG, lastSeen: Date.now() } }),

  clearConfig: () => set({ config: null }),
}));

// ── Helper: build a ConnectionConfig from a TauriDeviceInfo ──────────────────

import type { TauriDeviceInfo } from '../types/tauri';

export function deviceInfoToConfig(
  device: TauriDeviceInfo,
  protocol: ConnectionProtocol = 'lan',
): ConnectionConfig {
  const wsBase = device.api_base.replace(/^http/, 'ws');
  let deviceIp = device.api_base;
  try { deviceIp = new URL(device.api_base).hostname; } catch { /* keep original */ }

  return {
    apiBase:    device.api_base,
    wsUrl:      `${wsBase}/ws`,
    deviceName: device.device_name,
    deviceIp,
    deviceType: device.device_type,
    machineId:  device.machine_id ?? DEFAULT_MACHINE_ID,
    protocol,
    modbusPort: device.modbus_tcp_port,
    version:    device.software_version,
    lastSeen:   Date.now(),
  };
}
