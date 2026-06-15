export const RECONNECT_MS  = 3_000;
export const MAX_HISTORY   = 1_000;
export const CHART_FPS_MS  = 200;

/**
 * Sensor operating ranges and alarm thresholds.
 * Match the backend .env defaults.
 *   PRESSURE_MIN=4    PRESSURE_MAX=11   → WARNING=8.8   CRITICAL=10.45
 *   TEMPERATURE_MIN=50  TEMPERATURE_MAX=115 → WARNING=92.0  CRITICAL=109.25
 */
export const LIMITS = {
  pressure: {
    min:       4,
    max:       11,
    warning:   8.8,
    critical:  10.45,
    unit: 'bar',
    color:     '#38bdf8',
    colorWarn: '#ffb830',
    colorCrit: '#ff2d55',
    areaColor: 'rgba(56,189,248,0.18)',
  },
  temperature: {
    min:       50,
    max:       115,
    warning:   92.0,
    critical:  109.25,
    unit: '°C',
    color:     '#a78bfa',
    colorWarn: '#ffb830',
    colorCrit: '#ff2d55',
    areaColor: 'rgba(167,139,250,0.18)',
  },
} as const;

export type SensorType = keyof typeof LIMITS;

export const HEALTH_WARN = 70;
export const HEALTH_CRIT = 40;
