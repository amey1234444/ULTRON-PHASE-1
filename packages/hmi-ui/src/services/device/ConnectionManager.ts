/**
 * ConnectionManager.ts
 * Orchestrates the WS → Modbus → Client-Simulation fallback chain.
 *
 * Priority:
 *   1. WebSocket (primary)           ws://<device-ip>:8000/ws
 *   2. Modbus TCP (fallback)         <device-ip>:5020, FC4 registers
 *   3. Client-side simulation        pure frontend data generation
 *
 * Recovery:
 *   WebSocket reconnects continuously in the background while Modbus or
 *   simulation is active.  On successful WS reconnect, Modbus/sim is
 *   stopped and the stack promotes back to WebSocket automatically.
 */

import type { SensorReading }   from '../../types/sensor';
import { WebSocketService }      from '../websocket/WebSocketService';
import { ModbusTcpService }      from '../modbus/ModbusTcpService';
import { HealthMonitor }         from '../health/HealthMonitor';
import type { DataProtocol }     from './ConnectionTypes';
import { FALLBACK_CONFIG }       from './ConnectionTypes';
import type { ModbusSensorReading } from '../../types/tauri';

// ── Client-side simulation ────────────────────────────────────────────────────

/** Generate a plausible sensor reading without any network I/O. */
function generateSimReading(seq: number): SensorReading {
  const t    = (Date.now() / 1_000) + seq * 0.1;
  const pRaw = 7.0 + Math.sin(t * 0.12) * 0.85 + (Math.random() - 0.5) * 0.08;
  const tRaw = 80.5 + Math.sin(t * 0.07 + 1.5) * 7.2 + (Math.random() - 0.5) * 0.4;
  return {
    timestamp:   new Date().toISOString(),
    pressure:    Math.round(pRaw * 100) / 100,
    temperature: Math.round(tRaw * 10)  / 10,
    status:      'healthy',
  };
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface ConnectionManagerCallbacks {
  onReading:         (reading: SensorReading, latencyMs: number, protocol: DataProtocol) => void;
  onProtocolChange:  (protocol: DataProtocol) => void;
  onStatusChange:    (status: 'connected' | 'connecting' | 'disconnected' | 'error') => void;
  onReconnect:       () => void;
}

export interface ConnectionManagerConfig {
  wsUrl:      string;
  modbusHost: string;
  modbusPort: number;
  slaveId:    number;
  /** If true, skip Modbus and go straight to client sim on WS failure. */
  simOnly:    boolean;
  readModbusTcp?: (host: string, port: number, slaveId: number) => Promise<ModbusSensorReading>;
}

// ── ConnectionManager class ───────────────────────────────────────────────────

export class ConnectionManager {
  private ws:      WebSocketService  | null = null;
  private modbus:  ModbusTcpService  | null = null;
  private health   = new HealthMonitor();
  private simTimer: ReturnType<typeof setInterval> | null = null;
  private simSeq   = 0;

  private _protocol:  DataProtocol = 'none';
  private _destroyed  = false;
  /** Tracks whether we have already demoted — prevents re-entering _demoteToModbusOrSim
   *  on every WS onError call after the initial demotion. */
  private _demoted    = false;

  get protocol(): DataProtocol { return this._protocol; }

  constructor(
    private readonly cfg:  ConnectionManagerConfig,
    private readonly cbs:  ConnectionManagerCallbacks,
  ) {}

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  start(): void {
    if (this._destroyed) return;
    this._startWebSocket();
  }

  stop(): void {
    this._stopAll();
  }

  destroy(): void {
    this._destroyed = true;
    this._stopAll();
  }

  // ── WebSocket tier ──────────────────────────────────────────────────────────

  private _startWebSocket(): void {
    this._stopModbus();
    this._stopSim();

    // Reset demotion flag so the new WS attempt tracks failures from scratch.
    this._demoted = false;

    this.ws = new WebSocketService(
      this.cfg.wsUrl,
      {
        onMessage: (reading, latencyMs) => {
          if (this._destroyed) return;
          this.health.recordReading(latencyMs);
          this._setProtocol('websocket');
          this.cbs.onReading(reading, latencyMs, 'websocket');
        },

        onStatusChange: (status) => {
          if (this._destroyed) return;
          this.cbs.onStatusChange(status);

          if (status === 'connected') {
            // ── WS (re-)connected: promote back and tear down fallback tier ──
            this._stopModbus();
            this._stopSim();
            this._demoted = false;
            this._setProtocol('websocket');
          }
        },

        onError: () => {
          if (this._destroyed) return;
          // Only demote once; further errors while already demoted are ignored
          // because WS keeps reconnecting in the background.
          if (!this._demoted &&
              (this.ws?.consecutiveFails ?? 0) >= FALLBACK_CONFIG.wsFailuresBeforeModbus) {
            this._demoted = true;
            this._demoteToModbusOrSim();
          }
        },
      },
    );
    this.ws.connect();
  }

  // ── Modbus tier ─────────────────────────────────────────────────────────────

  private _demoteToModbusOrSim(): void {
    if (this.cfg.simOnly) {
      this._demoteToClientSim();
      return;
    }
    this._startModbus();
  }

  private _startModbus(): void {
    if (!this.cfg.readModbusTcp) {
      this._demoteToClientSim();
      return;
    }

    // Always stop an existing Modbus instance before creating a new one to
    // prevent duplicate poll timers if _startModbus is called more than once.
    this._stopModbus();
    this._stopSim();

    this.modbus = new ModbusTcpService(
      this.cfg.modbusHost,
      this.cfg.modbusPort,
      this.cfg.slaveId,
      {
        onReading: (reading) => {
          if (this._destroyed) return;
          // Ignore Modbus readings if WS has already recovered.
          if (this._protocol === 'websocket') return;
          this.health.recordReading(0);
          this._setProtocol('modbus');
          this.cbs.onReading(reading, 0, 'modbus');
        },

        onError: () => {
          if (this._destroyed) return;
          if ((this.modbus?.consecutiveFails ?? 0) >= FALLBACK_CONFIG.modbusFailuresBeforeSim) {
            this._stopModbus();
            this._demoteToClientSim();
          }
        },

        onStatusChange: (active) => {
          if (!active && !this._destroyed && this._protocol === 'modbus') {
            this.cbs.onStatusChange('disconnected');
          }
        },
      },
      this.cfg.readModbusTcp,
    );
    this.modbus.start();
    this.cbs.onStatusChange('connecting');
  }

  // ── Client-simulation tier ──────────────────────────────────────────────────

  private _demoteToClientSim(): void {
    this._stopModbus();
    this._stopSim();
    this._setProtocol('simulation-client');
    this.simSeq = 0;

    this.simTimer = setInterval(() => {
      if (this._destroyed) return;
      // Discard sim readings if WS has recovered while timer was still alive.
      if (this._protocol === 'websocket') return;
      const reading = generateSimReading(this.simSeq++);
      this.health.recordReading(0);
      this.cbs.onReading(reading, 0, 'simulation-client');
    }, FALLBACK_CONFIG.simIntervalMs);

    this.cbs.onStatusChange('disconnected');
  }

  // ── Stop helpers ────────────────────────────────────────────────────────────

  private _stopAll(): void {
    this.ws?.destroy();
    this.ws = null;
    this._stopModbus();
    this._stopSim();
    this.health.reset();
  }

  private _stopModbus(): void {
    this.modbus?.stop();
    this.modbus = null;
  }

  private _stopSim(): void {
    if (this.simTimer !== null) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
  }

  // ── Protocol update ─────────────────────────────────────────────────────────

  private _setProtocol(p: DataProtocol): void {
    if (this._protocol !== p) {
      this._protocol = p;
      this.cbs.onProtocolChange(p);
      if (p === 'websocket') this.cbs.onReconnect();
    }
  }

  // ── Health ──────────────────────────────────────────────────────────────────

  getHealthSnapshot() { return this.health.getSnapshot(); }
}
