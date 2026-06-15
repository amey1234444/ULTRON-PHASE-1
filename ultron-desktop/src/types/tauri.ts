/** Tauri-specific type definitions */

export interface BackendStatus {
  running:     boolean;
  pid:         number | null;
  port:        number;
  external:    boolean;  // true = already running before we launched it
  health_ok:   boolean;
  uptime_secs: number | null;
}

export interface TauriDeviceInfo {
  device_name:         string;
  device_type:         string;
  hostname:            string;
  /** The monitored machine ID (e.g. "RAV-01"). Optional — backends pre-Phase 12 omit it. */
  machine_id?:         string;
  serial_number?:      string;
  software_version:    string;
  supported_protocols: string[];
  api_port:            number;
  modbus_tcp_port:     number;
  api_base:            string;
}

export interface AppSettings {
  last_device_ip:       string | null;
  last_device_port:     number;
  last_backend_port:    number;
  last_modbus_tcp_port: number;
  last_rtu_port:        string | null;
  last_rtu_baudrate:    number;
  last_rtu_slave_id:    number;
  preferred_protocol:   string;
  simulation_mode:      boolean;
  theme:                string;
  window_width:         number;
  window_height:        number;
  backend_auto_start:   boolean;
}

export interface ModbusTarget {
  host:      string;
  port:      number;
  reachable: boolean;
}

/** Response from the `read_modbus_tcp` Tauri command. */
export interface ModbusSensorReading {
  pressure:    number;
  temperature: number;
}

export interface DiscoveryProgressEvent {
  phase:   'cache' | 'mdns' | 'subnet' | 'found' | 'error';
  message: string;
}
