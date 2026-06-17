/**
 * DeviceIdentity.ts
 * Types and helpers for ULTRON Edge device identity.
 * Mirrors the GET /api/device/identity response from the Pi backend.
 */

export interface DeviceIdentity {
  device_name:         string;
  device_type:         string;
  hostname:            string;
  machine_id:          string;   // e.g. "RAV-01"
  software_version:    string;
  supported_protocols: string[];
  api_port:            number;
  modbus_tcp_port:     number;
}

/** Expected device_name value used to validate discovery responses. */
export const EXPECTED_DEVICE_NAME = 'ULTRON Edge';

/** Expected device_type value. */
export const EXPECTED_DEVICE_TYPE = 'raspberry_pi_gateway';

/** Default machine_id when the backend doesn't return one. */
export const DEFAULT_MACHINE_ID = 'RAV-01';

/**
 * Returns the machine_id from a DeviceIdentity, falling back to the
 * well-known default if the field is missing.
 */
export function getMachineId(identity: Partial<DeviceIdentity>): string {
  return identity.machine_id ?? DEFAULT_MACHINE_ID;
}

/**
 * Validate that an identity response looks like an ULTRON Edge device.
 */
export function isValidIdentity(raw: Record<string, unknown>): boolean {
  return (
    typeof raw.device_name === 'string' &&
    raw.device_name === EXPECTED_DEVICE_NAME
  );
}
