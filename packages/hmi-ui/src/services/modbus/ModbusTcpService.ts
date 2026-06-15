/**
 * ModbusTcpService.ts
 * Polls the Pi's Modbus TCP server for pressure + temperature.
 * Used as the fallback data source when WebSocket is unavailable.
 *
 * Calls the Tauri `read_modbus_tcp` command — no browser WebSocket used here.
 */

import type { SensorReading } from '../../types/sensor';
import { FALLBACK_CONFIG }    from '../device/ConnectionTypes';
import type { ModbusSensorReading } from '../../types/tauri';

export interface ModbusCallbacks {
  onReading:      (reading: SensorReading) => void;
  onError:        (reason: string)         => void;
  onStatusChange: (active: boolean)        => void;
}

export class ModbusTcpService {
  private pollTimer:   ReturnType<typeof setInterval> | null = null;
  private _active      = false;
  private _consecFails = 0;

  get consecutiveFails(): number { return this._consecFails; }
  get isActive():         boolean { return this._active; }

  constructor(
    private readonly host:      string,
    private readonly port:      number,
    private readonly slaveId:   number,
    private readonly callbacks: ModbusCallbacks,
    private readonly readModbusTcp: (host: string, port: number, slaveId: number) => Promise<ModbusSensorReading>,
    private readonly pollMs:    number = FALLBACK_CONFIG.modbusPollingMs,
  ) {}

  start(): void {
    if (this._active) return;
    this._active = true;
    this._consecFails = 0;
    this.callbacks.onStatusChange(true);
    this._poll();
    this.pollTimer = setInterval(() => { this._poll(); }, this.pollMs);
  }

  stop(): void {
    if (!this._active) return;
    this._active = false;
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.callbacks.onStatusChange(false);
  }

  private _poll(): void {
    this.readModbusTcp(this.host, this.port, this.slaveId)
      .then((result) => {
        this._consecFails = 0;
        const reading: SensorReading = {
          timestamp:   new Date().toISOString(),
          pressure:    result.pressure,
          temperature: result.temperature,
          status:      'healthy',
        };
        this.callbacks.onReading(reading);
      })
      .catch((err: unknown) => {
        this._consecFails++;
        const reason = err instanceof Error ? err.message : String(err);
        this.callbacks.onError(reason);
      });
  }
}
