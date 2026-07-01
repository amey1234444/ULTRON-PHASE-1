import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AppPhase =
  | 'splash'       // Startup sequence (backend start → discovery)
  | 'discovery'    // User is manually selecting / searching for a device
  | 'connected'    // Live dashboard with real hardware
  | 'settings'     // Settings screen
  | 'diagnostics'; // Diagnostics screen

export type SplashStep =
  | 'init'
  | 'starting-backend'
  | 'backend-ready'
  | 'searching-mdns'
  | 'searching-subnet'
  | 'checking-modbus'
  | 'device-found'
  | 'done'
  | 'error';

interface AppStore {
  appPhase:       AppPhase;
  splashStep:     SplashStep;
  splashMessage:  string;
  backendRunning: boolean;
  appVersion:     string;
  previousPhase:  AppPhase | null;

  setAppPhase:        (phase: AppPhase)                      => void;
  setSplashStep:      (step: SplashStep, message: string)    => void;
  setBackendRunning:  (running: boolean)                      => void;
  setAppVersion:      (version: string)                       => void;
  goToSettings:       ()                                      => void;
  goToDiagnostics:    ()                                      => void;
  goBack:             ()                                      => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>((set, get) => ({
  appPhase:       'splash',
  splashStep:     'init',
  splashMessage:  'Initializing ULTRON…',
  backendRunning: false,
  appVersion:     '1.0.0',
  previousPhase:  null,

  setAppPhase: (appPhase) =>
    set((state) => ({
      appPhase,
      previousPhase: state.appPhase !== appPhase ? state.appPhase : state.previousPhase,
    })),

  setSplashStep: (splashStep, splashMessage) =>
    set({ splashStep, splashMessage }),

  setBackendRunning: (backendRunning) => set({ backendRunning }),

  setAppVersion: (appVersion) => set({ appVersion }),

  goToSettings: () =>
    set((state) => ({ appPhase: 'settings', previousPhase: state.appPhase })),

  goToDiagnostics: () =>
    set((state) => ({ appPhase: 'diagnostics', previousPhase: state.appPhase })),

  goBack: () => {
    const prev = get().previousPhase;
    if (prev) set({ appPhase: prev, previousPhase: null });
    else set({ appPhase: 'connected' });
  },
}));
