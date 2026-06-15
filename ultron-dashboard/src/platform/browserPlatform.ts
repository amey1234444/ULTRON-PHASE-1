import type {
  AppSettings,
  BackendStatus,
  DeviceInfo,
  HmiPlatform,
  ModbusTarget,
} from '@ultron/hmi-core';
import { DEFAULT_APP_SETTINGS } from '@ultron/hmi-core';

const SETTINGS_KEY = 'ultron.browser.settings';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_APP_SETTINGS };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

function persistSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

async function probe(apiBase: string): Promise<DeviceInfo> {
  const res = await fetch(`${apiBase}/api/device/identity`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`No ULTRON device found at ${apiBase}`);
  const device = await res.json() as Omit<DeviceInfo, 'api_base'>;
  return { ...device, api_base: apiBase };
}

async function backendStatus(port = 8000): Promise<BackendStatus> {
  try {
    const res = await fetch(`http://localhost:${port}/health`, { cache: 'no-store' });
    const health = await res.json();
    return {
      running: res.ok,
      pid: null,
      port,
      external: true,
      health_ok: res.ok && health.status === 'ok',
      uptime_secs: typeof health.uptime_seconds === 'number' ? health.uptime_seconds : null,
    };
  } catch {
    return { running: false, pid: null, port, external: true, health_ok: false, uptime_secs: null };
  }
}

export const browserPlatform: HmiPlatform = {
  kind: 'browser',
  canStartBackend: false,

  async startBackend() {
    return backendStatus(loadSettings().last_backend_port);
  },

  async stopBackend() {},

  async getBackendStatus() {
    return backendStatus(loadSettings().last_backend_port);
  },

  async setBackendPort(port: number) {
    persistSettings({ ...loadSettings(), last_backend_port: port });
  },

  async getSavedSettings() {
    return loadSettings();
  },

  async saveSettings(patch: Partial<AppSettings>) {
    const next = { ...loadSettings(), ...patch };
    persistSettings(next);
    return next;
  },

  async discoverDevices(lastKnownIp?: string) {
    const ports = [8000, 8080];
    const hosts = [
      lastKnownIp,
      'localhost',
      'ultron-edge.local',
      'raspberrypi.local',
      'raspberrypi',
    ].filter(Boolean) as string[];

    const found: DeviceInfo[] = [];
    for (const host of hosts) {
      for (const port of ports) {
        try {
          const apiBase = host.startsWith('http') ? host : `http://${host}:${port}`;
          const device = await probe(apiBase);
          if (!found.some((d) => d.api_base === device.api_base)) found.push(device);
        } catch {
          // Try the next browser-reachable candidate.
        }
      }
    }
    return found;
  },

  async connectDevice(apiBase: string) {
    return probe(apiBase);
  },

  async scanModbusTcp(): Promise<ModbusTarget[]> {
    return [];
  },

  async getAppVersion() {
    return '1.0.0';
  },

  async getLocalIp() {
    try { return new URL(window.location.origin).hostname; } catch { return ''; }
  },

  async startSimulation() {},
  async stopSimulation() {},
};
