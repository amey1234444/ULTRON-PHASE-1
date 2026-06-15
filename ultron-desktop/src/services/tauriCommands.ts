/**
 * Typed wrappers around Tauri invoke() calls.
 * All Rust commands are declared here — import from this file, never invoke() directly.
 */
import { invoke } from '@tauri-apps/api/core';
import type { BackendStatus, TauriDeviceInfo, AppSettings, ModbusTarget, ModbusSensorReading } from '../types/tauri';

// ── Backend management ────────────────────────────────────────────────────────

export const startBackend = (): Promise<BackendStatus> =>
  invoke<BackendStatus>('start_backend');

export const stopBackend = (): Promise<void> =>
  invoke<void>('stop_backend');

export const getBackendStatus = (): Promise<BackendStatus> =>
  invoke<BackendStatus>('get_backend_status');

export const setBackendPort = (port: number): Promise<void> =>
  invoke<void>('set_backend_port', { port });

// ── Device discovery ──────────────────────────────────────────────────────────

export const discoverDevices = (lastKnownIp?: string): Promise<TauriDeviceInfo[]> =>
  invoke<TauriDeviceInfo[]>('discover_devices', { lastKnownIp: lastKnownIp ?? null });

export const connectDevice = (apiBase: string): Promise<TauriDeviceInfo> =>
  invoke<TauriDeviceInfo>('connect_device', { apiBase });

// ── Settings ──────────────────────────────────────────────────────────────────

export const getSavedSettings = (): Promise<AppSettings> =>
  invoke<AppSettings>('get_saved_settings');

export const saveSettings = (settings: Partial<AppSettings>): Promise<AppSettings> =>
  invoke<AppSettings>('save_settings', { settings });

// ── Simulation mode ───────────────────────────────────────────────────────────

export const startSimulation = (): Promise<void> =>
  invoke<void>('start_simulation');

export const stopSimulation = (): Promise<void> =>
  invoke<void>('stop_simulation');

// ── Modbus discovery ──────────────────────────────────────────────────────────

export const scanModbusTcp = (host?: string): Promise<ModbusTarget[]> =>
  invoke<ModbusTarget[]>('scan_modbus_tcp', { host: host ?? null });

// ── Modbus TCP sensor read ────────────────────────────────────────────────────

/** Read pressure + temperature from the Pi's Modbus TCP server (FC4, ABCD byte order). */
export const readModbusTcp = (
  host:     string,
  port:     number,
  slaveId:  number,
): Promise<ModbusSensorReading> =>
  invoke<ModbusSensorReading>('read_modbus_tcp', { host, port, slaveId });

// ── App info ──────────────────────────────────────────────────────────────────

export const getAppVersion = (): Promise<string> =>
  invoke<string>('get_app_version');

/** Returns the machine's primary LAN IP (e.g. "192.168.10.5"), or empty string. */
export const getLocalIp = (): Promise<string> =>
  invoke<string>('get_local_ip');
