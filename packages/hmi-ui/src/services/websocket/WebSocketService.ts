/**
 * WebSocketService.ts
 * Standalone WebSocket client for ULTRON sensor data.
 *
 * Latency is measured via application-level ping/pong (client timestamp
 * round-trip) so the result is independent of clock skew between the Pi
 * and the laptop.  Sends a ping every PING_INTERVAL_MS; latency = RTT / 2.
 *
 * Before the first pong the reported latency is 0 (UI shows "—").
 */

import type { SensorReading } from '../../types/sensor';
import { FALLBACK_CONFIG } from '../device/ConnectionTypes';

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketCallbacks {
  onMessage:      (reading: SensorReading, latencyMs: number) => void;
  onStatusChange: (status: WsStatus) => void;
  onError?:       (reason: string) => void;
}

const PING_INTERVAL_MS = 2_000;
const LATENCY_WINDOW   = 5;   // rolling average over last N pongs
const MAX_LATENCY_MS   = 9_999; // cap display at 10s

export class WebSocketService {
  private ws:             WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout>  | null = null;
  private pingTimer:      ReturnType<typeof setInterval> | null = null;
  private _destroyed      = false;
  private _consecutiveFails = 0;
  /** One-way latency in ms (rolling avg, capped). 0 = no pong yet. */
  private _latencyMs      = 0;
  private _latencyHistory: number[] = [];

  get consecutiveFails(): number { return this._consecutiveFails; }

  constructor(
    private readonly url:         string,
    private readonly callbacks:   WebSocketCallbacks,
    private readonly reconnectMs: number = FALLBACK_CONFIG.wsReconnectMs,
  ) {}

  connect(): void {
    if (this._destroyed) return;
    this._clearReconnect();
    this.callbacks.onStatusChange('connecting');

    const ws = new WebSocket(this.url);
    this.ws  = ws;

    ws.onopen = () => {
      if (this._destroyed || ws !== this.ws) return;
      this._consecutiveFails = 0;
      this._latencyMs        = 0;   // reset until first pong
      this._latencyHistory   = [];
      this.callbacks.onStatusChange('connected');
      this._startPing();
    };

    ws.onmessage = (evt: MessageEvent<string>) => {
      if (this._destroyed || ws !== this.ws) return;
      try {
        const frame = JSON.parse(evt.data) as Record<string, unknown>;

        // Pong response — measure RTT and derive one-way latency (rolling avg, capped)
        if (frame.type === 'pong' && typeof frame.t === 'number') {
          const rtt = Date.now() - (frame.t as number);
          const oneWay = Math.max(0, Math.round(rtt / 2));
          const capped = Math.min(oneWay, MAX_LATENCY_MS);
          this._latencyHistory.push(capped);
          if (this._latencyHistory.length > LATENCY_WINDOW) {
            this._latencyHistory.shift();
          }
          const sum = this._latencyHistory.reduce((a, b) => a + b, 0);
          this._latencyMs = Math.round(sum / this._latencyHistory.length);
          return;
        }

        // Regular sensor reading
        const data = frame as unknown as SensorReading;
        if (typeof data.pressure === 'number' && data.source === 'bridge') {
          this.callbacks.onMessage(data, this._latencyMs);
        }
      } catch {
        /* Malformed frame — ignore */
      }
    };

    ws.onerror = () => {
      if (this._destroyed || ws !== this.ws) return;
      this._consecutiveFails++;
      this.callbacks.onStatusChange('error');
      this.callbacks.onError?.(`WebSocket error (failures: ${this._consecutiveFails})`);
    };

    ws.onclose = () => {
      if (this._destroyed || ws !== this.ws) return;
      this._consecutiveFails++;
      this._stopPing();
      this.callbacks.onStatusChange('disconnected');
      this._scheduleReconnect();
    };
  }

  /** Close the socket without scheduling a reconnect. */
  disconnect(): void {
    this._clearReconnect();
    this._close();
  }

  /** Permanently stop — no reconnects after this. */
  destroy(): void {
    this._destroyed = true;
    this.disconnect();
  }

  private _startPing(): void {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
        } catch { /* socket may have closed */ }
      }
    }, PING_INTERVAL_MS);
  }

  private _stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private _close(): void {
    this._stopPing();
    if (this.ws) {
      this.ws.onopen    = null;
      this.ws.onmessage = null;
      this.ws.onerror   = null;
      this.ws.onclose   = null;
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
  }

  private _scheduleReconnect(): void {
    if (this._destroyed) return;
    this._clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      if (!this._destroyed) this.connect();
    }, this.reconnectMs);
  }

  private _clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
