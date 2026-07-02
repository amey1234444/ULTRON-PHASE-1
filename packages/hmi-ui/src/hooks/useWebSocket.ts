import { useEffect, useRef, useCallback } from 'react';
import { useSensorStore }     from '../store/sensorStore';
import { useConnectionStore } from '../store/connectionStore';
import { RECONNECT_MS }       from '../config/constants';
import type { SensorReading } from '../types/sensor';

/**
 * Establishes a WebSocket connection to the discovered backend,
 * feeds readings into the Zustand sensor store, and auto-reconnects on failure.
 *
 * Call once at the root of the DashboardPage component tree.
 * The WS URL is derived from the connection store so it automatically reflects
 * whichever device was found by the Tauri discovery command.
 */
export function useWebSocket(): void {
  const wsRef        = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef   = useRef(true);

  const addReading        = useSensorStore((s) => s.addReading);
  const setStatus         = useSensorStore((s) => s.setConnectionStatus);
  const incrementReconnect = useSensorStore((s) => s.incrementReconnect);
  const wsUrl             = useConnectionStore((s) => s.config?.wsUrl ?? 'ws://localhost:8000/ws');

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    setStatus('connecting');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus('connected');
    };

    ws.onmessage = (evt: MessageEvent<string>) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(evt.data) as SensorReading;
        if (typeof data.pressure === 'number' && typeof data.temperature === 'number' && data.source === 'bridge') {
          addReading(data);
        }
      } catch {
        // Malformed frame — ignore silently
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setStatus('error');
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      incrementReconnect();
      reconnectRef.current = setTimeout(connect, RECONNECT_MS);
    };
  }, [wsUrl, addReading, setStatus, incrementReconnect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
