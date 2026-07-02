export type SystemStatus = 'healthy' | 'warning' | 'critical' | 'offline';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface SensorReading {
  timestamp:   string;
  pressure:    number;
  /** null when the temperature sensor is not connected or in a read-error state */
  temperature: number | null;
  status?:     SystemStatus;
  /** Extra fields sent by some Pi backends (ignored by core logic) */
  machine_id?: string;
  /** Reported bridge IP label used with machine_id for routing */
  bridge_ip?:  string;
  /** Matched asset node id when the reading was routed via a device binding */
  device_id?:  string;
  /** Equipment type node id carried by routed bridge websocket payloads */
  equipment_type_id?: string;
  /** Backend data source; live HMI views only accept bridge readings */
  source?:     'bridge' | string;
  mode?:       string;
  sequence?:   number;
}

export interface DeviceInfo {
  device_id:            string;
  app_name:             string;
  version:              string;
  pressure_sensor:      string;
  temperature_sensor:   string;
  broadcast_interval_ms: number;
  mode:                 string;
}

export interface HealthInfo {
  status:          string;
  uptime_seconds:  number;
  mode:            string;
  version:         string;
}

export interface AlarmState {
  llPressure:     boolean;
  lPressure:      boolean;
  hPressure:      boolean;
  hhPressure:     boolean;
  llTemperature:  boolean;
  lTemperature:   boolean;
  hTemperature:   boolean;
  hhTemperature:  boolean;
}

/** Response from GET /api/device/identity */
export interface DeviceIdentity {
  device_name:         string;
  device_type:         string;
  hostname:            string;
  software_version:    string;
  supported_protocols: string[];
  api_port:            number;
  modbus_tcp_port:     number;
  api_base:            string;
}
