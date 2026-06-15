import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AlarmEvent {
  id: string;
  alarmId: string;
  label: string;
  tag: string;
  severity: 'warning' | 'critical';
  value: string;
  firedAt: string;
  clearedAt: string | null;
}

interface AlarmStore {
  /** IDs of currently-active alarms the operator has acknowledged. Auto-cleared when the alarm clears. */
  ackedIds: string[];
  /** Rolling log of alarm events — newest first, max 200. */
  history: AlarmEvent[];
  ack: (alarmId: string) => void;
  recordFired: (event: AlarmEvent) => void;
  recordCleared: (alarmId: string, clearedAt: string) => void;
  clearHistory: () => void;
}

export const useAlarmStore = create<AlarmStore>()(
  persist(
    (set) => ({
      ackedIds: [],
      history: [],

      ack: (alarmId) =>
        set((s) => ({
          ackedIds: s.ackedIds.includes(alarmId) ? s.ackedIds : [...s.ackedIds, alarmId],
        })),

      recordFired: (event) =>
        set((s) => ({ history: [event, ...s.history].slice(0, 200) })),

      recordCleared: (alarmId, clearedAt) =>
        set((s) => ({
          ackedIds: s.ackedIds.filter((id) => id !== alarmId),
          history: s.history.map((e) =>
            e.alarmId === alarmId && e.clearedAt === null ? { ...e, clearedAt } : e,
          ),
        })),

      clearHistory: () => set({ history: [] }),
    }),
    { name: 'ultron-alarms' },
  ),
);
