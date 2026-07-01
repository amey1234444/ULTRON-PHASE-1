/**
 * useConnectionManager
 * ====================
 * React hook that starts and tears down a ConnectionManager for the
 * lifetime of the dashboard layout.
 *
 * Replaces the simpler useWebSocket hook.  Handles:
 *   WS (primary) → Modbus TCP (fallback)
 *
 * Stores results in Zustand (sensorStore + connectionStore) so every
 * component can subscribe with fine-grained selectors.
 */

import { useEffect, useRef } from 'react';
import { ConnectionManager }  from '../services/device/ConnectionManager';
import { useSensorStore }     from '../store/sensorStore';
import { useConnectionStore } from '../store/connectionStore';
import { useAppStore }        from '../store/appStore';
import type { DataProtocol }  from '../services/device/ConnectionTypes';
import { usePlatform }        from '../platform/PlatformContext';

export function useConnectionManager(): void {
  const platform = usePlatform();
  const managerRef = useRef<ConnectionManager | null>(null);

  // Zustand actions — captured once (stable references from create())
  const addReading         = useSensorStore((s) => s.addReading);
  const setStatus          = useSensorStore((s) => s.setConnectionStatus);
  const setActiveProtocol  = useSensorStore((s) => s.setActiveProtocol);
  const incrementReconnect = useSensorStore((s) => s.incrementReconnect);

  // Config from connection store
  const config   = useConnectionStore((s) => s.config);
  const appPhase = useAppStore((s) => s.appPhase);

  useEffect(() => {
    if (!config) return;

    const manager = new ConnectionManager(
      {
        wsUrl:      config.wsUrl,
        modbusHost: config.deviceIp,
        modbusPort: config.modbusPort,
        slaveId:    1,
        readModbusTcp: platform.readModbusTcp,
      },
      {
        onReading: (reading, latencyMs, protocol: DataProtocol) => {
          addReading(reading, latencyMs, protocol);
        },

        onProtocolChange: (protocol: DataProtocol) => {
          setActiveProtocol(protocol);
        },

        onStatusChange: (status) => {
          // Map internal statuses to the sensorStore ConnectionStatus type
          if (status === 'connected') {
            setStatus('connected');
          } else if (status === 'connecting') {
            setStatus('connecting');
          } else if (status === 'error') {
            setStatus('error');
          } else {
            setStatus('disconnected');
          }
        },

        onReconnect: () => {
          incrementReconnect();
        },
      },
    );

    managerRef.current = manager;
    manager.start();

    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  // Re-create when the device config changes (new Pi found, or switch to/from sim)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.wsUrl, config?.deviceIp, config?.modbusPort, appPhase, platform]);
}
