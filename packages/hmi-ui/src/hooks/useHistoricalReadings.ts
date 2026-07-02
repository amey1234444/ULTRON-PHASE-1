import { useState, useEffect, useMemo } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { useSensorStore }     from '../store/sensorStore';
import type { SensorReading } from '../types/sensor';

/**
 * Fetches the last `minutes` of readings from the backend DB on mount,
 * then merges them with the live sensorStore buffer so new readings
 * continue to appear without a gap.
 *
 * Silently falls back to live-only data if the backend is unreachable.
 */
export function useHistoricalReadings(minutes: number): SensorReading[] {
  const apiBase       = useConnectionStore((s) => s.config?.apiBase ?? 'http://localhost:8000');
  const storeReadings = useSensorStore((s) => s.readings);
  const activeBinding = useSensorStore((s) => s.activeBinding);
  const requiresBinding = useSensorStore((s) => s.requiresBinding);
  const [dbReadings, setDbReadings] = useState<SensorReading[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const to   = new Date().toISOString();
        const from = new Date(Date.now() - minutes * 60_000).toISOString();
        const params = new URLSearchParams({ from_ts: from, to_ts: to, limit: '5000' });
        if (activeBinding) {
          params.set('machine_id', activeBinding.machineId);
          params.set('bridge_ip', activeBinding.ip);
          params.set('equipment_type_id', activeBinding.nodeId);
        }
        const res = await fetch(`${apiBase}/api/sensors/history?${params}`);
        if (!res.ok || cancelled) return;
        const data: { readings: SensorReading[] } = await res.json();
        if (!cancelled) {
          setDbReadings(data.readings.filter((r) => r.source === 'bridge').reverse());
        }
      } catch {
        // No backend or DB disabled — fall through to live-only
      }
    };
    if (requiresBinding && !activeBinding) {
      setDbReadings([]);
      return () => { cancelled = true; };
    }
    load();
    return () => { cancelled = true; };
  }, [activeBinding, apiBase, minutes, requiresBinding]);

  // Merge: DB readings up to their last timestamp, then live readings after that
  return useMemo(() => {
    const liveBridgeReadings = storeReadings.filter((r) => r.source === 'bridge');
    if (!dbReadings.length) return liveBridgeReadings;
    const cutoff   = dbReadings[dbReadings.length - 1]?.timestamp ?? '';
    const liveTail = liveBridgeReadings.filter((r) => r.timestamp > cutoff);
    const merged   = [...dbReadings, ...liveTail];
    return merged.length > 20_000 ? merged.slice(-20_000) : merged;
  }, [dbReadings, storeReadings]);
}
