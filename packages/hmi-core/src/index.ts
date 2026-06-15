export type PlatformKind = 'browser' | 'tauri';

export interface BackendStatus {
  running: boolean;
  pid: number | null;
  port: number;
  external: boolean;
  health_ok: boolean;
  uptime_secs: number | null;
}

export interface DeviceInfo {
  device_name: string;
  device_type: string;
  hostname: string;
  machine_id?: string;
  serial_number?: string;
  software_version: string;
  supported_protocols: string[];
  api_port: number;
  modbus_tcp_port: number;
  api_base: string;
}

export interface AppSettings {
  last_device_ip: string | null;
  last_device_port: number;
  last_backend_port: number;
  last_modbus_tcp_port: number;
  last_rtu_port: string | null;
  last_rtu_baudrate: number;
  last_rtu_slave_id: number;
  preferred_protocol: string;
  simulation_mode: boolean;
  theme: string;
  window_width: number;
  window_height: number;
  backend_auto_start: boolean;
}

export interface ModbusTarget {
  host: string;
  port: number;
  reachable: boolean;
}

export interface ModbusSensorReading {
  pressure: number;
  temperature: number;
}

export interface DiscoveryProgressEvent {
  phase: 'cache' | 'mdns' | 'subnet' | 'found' | 'error';
  message: string;
}

export interface HmiPlatform {
  kind: PlatformKind;
  canStartBackend: boolean;
  startBackend(): Promise<BackendStatus>;
  stopBackend(): Promise<void>;
  getBackendStatus(): Promise<BackendStatus>;
  setBackendPort(port: number): Promise<void>;
  getSavedSettings(): Promise<AppSettings>;
  saveSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
  discoverDevices(lastKnownIp?: string): Promise<DeviceInfo[]>;
  connectDevice(apiBase: string): Promise<DeviceInfo>;
  readModbusTcp?(host: string, port: number, slaveId: number): Promise<ModbusSensorReading>;
  scanModbusTcp?(host?: string): Promise<ModbusTarget[]>;
  getAppVersion(): Promise<string>;
  getLocalIp(): Promise<string>;
  startSimulation(): Promise<void>;
  stopSimulation(): Promise<void>;
  onDiscoveryProgress?(handler: (event: DiscoveryProgressEvent) => void): Promise<() => void>;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  last_device_ip: null,
  last_device_port: 8000,
  last_backend_port: 8000,
  last_modbus_tcp_port: 5020,
  last_rtu_port: null,
  last_rtu_baudrate: 9600,
  last_rtu_slave_id: 1,
  preferred_protocol: 'websocket',
  simulation_mode: false,
  theme: 'dark',
  window_width: 1440,
  window_height: 900,
  backend_auto_start: true
};
