/**
 * ConnectionTypes.ts
 * Shared type definitions for the connection layer.
 */

/** Active data transport to sensor readings. */
export type DataProtocol =
  | 'websocket'          // WebSocket to Pi (primary)
  | 'modbus'             // Modbus TCP to Pi (fallback)
  | 'simulation-backend' // Local backend running sim mode
  | 'simulation-client'  // Client-side generated values (last resort)
  | 'none';

/** High-level connection lifecycle state. */
export type ConnectionPhase =
  | 'idle'
  | 'connecting-ws'
  | 'websocket-active'
  | 'connecting-modbus'
  | 'modbus-active'
  | 'simulation-active'
  | 'disconnected'
  | 'error';

/** Live health snapshot exposed to the UI. */
export interface ConnectionHealth {
  phase:          ConnectionPhase;
  dataProtocol:   DataProtocol;
  latencyMs:      number;
  reconnectCount: number;
  wsFailures:     number;
  modbusFailures: number;
  lastUpdateMs:   number;  // epoch ms of most recent reading
}

/** Tunable thresholds for automatic fallback decisions. */
export const FALLBACK_CONFIG = {
  // 3 consecutive WS errors (~9 s) before trying Modbus.
  // Reduced from 5 for faster failover without being trigger-happy on brief glitches.
  wsFailuresBeforeModbus:   3,
  modbusFailuresBeforeSim:  5,    // consecutive Modbus errors → client sim
  wsReconnectMs:            3_000,
  modbusPollingMs:          250,
  simIntervalMs:            100,
  maxDisplayLatencyMs:      9_999, // cap for wildly skewed clocks
} as const;
