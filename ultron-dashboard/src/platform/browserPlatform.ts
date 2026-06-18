import type {
  AppSettings,
  BackendStatus,
  DeviceInfo,
  HmiPlatform,
  ModbusTarget,
} from '@ultron/hmi-core';
import { DEFAULT_APP_SETTINGS } from '@ultron/hmi-core';

const SETTINGS_KEY = 'ultron.browser.settings';
const ENV_API_BASE = import.meta.env.VITE_API_BASE ?? '';

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

async function probe(apiBase: string, timeoutMs = 10000): Promise<DeviceInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiBase}/api/device/identity`, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`No ULTRON device found at ${apiBase}`);
    const device = await res.json() as Omit<DeviceInfo, 'api_base'>;
    return { ...device, api_base: apiBase };
  } finally {
    clearTimeout(timer);
  }
}

async function backendStatus(port = 8000): Promise<BackendStatus> {
  const healthUrl = ENV_API_BASE ? `${ENV_API_BASE}/health` : `http://localhost:${port}/health`;
  // Retry up to 3 times with increasing delay for cloud cold-start
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(healthUrl, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timer);
      const health = await res.json();
      return {
        running: res.ok,
        pid: null,
        port,
        external: !!ENV_API_BASE,
        health_ok: res.ok && health.status === 'ok',
        uptime_secs: typeof health.uptime_seconds === 'number' ? health.uptime_seconds : null,
      };
    } catch {
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return { running: false, pid: null, port, external: !!ENV_API_BASE, health_ok: false, uptime_secs: null };
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
    const found: DeviceInfo[] = [];

    // Try env-configured backend first (production deployment)
    // Use longer timeout for cloud hosts that may cold-start (e.g. Render free tier)
    if (ENV_API_BASE) {
      try {
        const device = await probe(ENV_API_BASE, 45000);
        found.push(device);
        return found;
      } catch { /* fall through to local discovery */ }
    }

    const ports = [8000, 8080];
    const hosts = [
      lastKnownIp,
      'localhost',
      'ultron-edge.local',
      'raspberrypi.local',
      'raspberrypi',
    ].filter(Boolean) as string[];

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
