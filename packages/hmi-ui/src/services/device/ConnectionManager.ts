/**
 * ConnectionManager.ts
 * Orchestrates the WS → Modbus fallback chain.
 *
 * Priority:
 *   1. WebSocket (primary)           ws://<device-ip>:8000/ws
 *   2. Modbus TCP (fallback)         <device-ip>:5020, FC4 registers
 *
 * Recovery:
 *   WebSocket reconnects continuously in the background while Modbus
 *   is active.  On successful WS reconnect, Modbus is stopped and the
 *   stack promotes back to WebSocket automatically.
 */

import type { SensorReading }   from '../../types/sensor';
import { WebSocketService }      from '../websocket/WebSocketService';
import { ModbusTcpService }      from '../modbus/ModbusTcpService';
import { HealthMonitor }         from '../health/HealthMonitor';
import type { DataProtocol }     from './ConnectionTypes';
import { FALLBACK_CONFIG }       from './ConnectionTypes';
import type { ModbusSensorReading } from '../../types/tauri';

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
  readModbusTcp?: (host: string, port: number, slaveId: number) => Promise<ModbusSensorReading>;
}

// ── ConnectionManager class ───────────────────────────────────────────────────

export class ConnectionManager {
  private ws:      WebSocketService  | null = null;
  private modbus:  ModbusTcpService  | null = null;
  private health   = new HealthMonitor();

  private _protocol:  DataProtocol = 'none';
  private _destroyed  = false;
  /** Tracks whether we have already demoted — prevents re-entering _demoteToModbus
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
            this._demoteToModbus();
          }
        },
      },
    );
    this.ws.connect();
  }

  // ── Modbus tier ─────────────────────────────────────────────────────────────

  private _demoteToModbus(): void {
    this._startModbus();
  }

  private _startModbus(): void {
    if (!this.cfg.readModbusTcp) {
      this.cbs.onStatusChange('disconnected');
      return;
    }

    this._stopModbus();

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
          if ((this.modbus?.consecutiveFails ?? 0) >= FALLBACK_CONFIG.modbusFailuresBeforeDisconnect) {
            this._stopModbus();
            this.cbs.onStatusChange('disconnected');
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

  // ── Stop helpers ────────────────────────────────────────────────────────────

  private _stopAll(): void {
    this.ws?.destroy();
    this.ws = null;
    this._stopModbus();
    this.health.reset();
  }

  private _stopModbus(): void {
    this.modbus?.stop();
    this.modbus = null;
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
