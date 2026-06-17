import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LIMITS, HEALTH_WARN, HEALTH_CRIT } from '../config/constants';

export interface SensorThresholds {
  ll: number;
  l:  number;
  h:  number;
  hh: number;
}

export interface HealthThresholds {
  ll: number;
  l:  number;
}

interface ThresholdStore {
  pressure:    SensorThresholds;
  temperature: SensorThresholds;
  health:      HealthThresholds;
  setPressure:    (t: SensorThresholds) => void;
  setTemperature: (t: SensorThresholds) => void;
  setHealth:      (t: HealthThresholds) => void;
}

export const useThresholdStore = create<ThresholdStore>()(
  persist(
    (set) => ({
      pressure: {
        ll: 4.5,
        l:  5.5,
        h:  LIMITS.pressure.warning,
        hh: LIMITS.pressure.critical,
      },
      temperature: {
        ll: 55,
        l:  65,
        h:  LIMITS.temperature.warning,
        hh: LIMITS.temperature.critical,
      },
      health: {
        ll: HEALTH_CRIT,
        l:  HEALTH_WARN,
      },
      setPressure:    (pressure)    => set({ pressure }),
      setTemperature: (temperature) => set({ temperature }),
      setHealth:      (health)      => set({ health }),
    }),
    { name: 'ultron-thresholds' }
  )
);
