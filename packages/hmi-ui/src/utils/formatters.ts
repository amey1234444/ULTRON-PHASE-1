import type { SystemStatus } from '../types/sensor';
import { LIMITS, HEALTH_WARN, HEALTH_CRIT, type SensorType } from '../config/constants';

export function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour12: false });
  } catch {
    return '--:--:--';
  }
}

export function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function getSensorStatus(type: SensorType, value: number): SystemStatus {
  const l = LIMITS[type];
  if (value >= l.critical) return 'critical';
  if (value >= l.warning)  return 'warning';
  return 'healthy';
}

export function getStatusColor(status: SystemStatus): string {
  const map: Record<SystemStatus, string> = {
    healthy:  '#20D068',
    warning:  '#FFB020',
    critical: '#FF4040',
    offline:  '#2A4A6A',
  };
  return map[status];
}

export function computeHealthScore(pressure: number, temperature: number | null): number {
  function penalty(value: number, limits: { min: number; max: number; warning: number; critical: number }) {
    const pct = (value - limits.min) / (limits.max - limits.min);
    if (pct >= 0.95) return 65 + (pct - 0.95) * 700;
    if (pct >= 0.80) return (pct - 0.80) * (65 / 0.15);
    return 0;
  }
  // When temperature sensor is disconnected, only penalise based on pressure
  const total = penalty(pressure, LIMITS.pressure) +
                (temperature !== null ? penalty(temperature, LIMITS.temperature) : 0);
  return Math.max(0, Math.min(100, Math.round(100 - total)));
}

export function getHealthStatus(score: number): SystemStatus {
  if (score < HEALTH_CRIT) return 'critical';
  if (score < HEALTH_WARN) return 'warning';
  return 'healthy';
}

export function getHealthColor(score: number): string {
  return getStatusColor(getHealthStatus(score));
}
