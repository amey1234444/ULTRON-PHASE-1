import { listen } from '@tauri-apps/api/event';
import type { DiscoveryProgressEvent, HmiPlatform } from '@ultron/hmi-core';
import * as cmd from '../services/tauriCommands';

export const tauriPlatform: HmiPlatform = {
  kind: 'tauri',
  canStartBackend: true,
  startBackend: cmd.startBackend,
  stopBackend: cmd.stopBackend,
  getBackendStatus: cmd.getBackendStatus,
  setBackendPort: cmd.setBackendPort,
  getSavedSettings: cmd.getSavedSettings,
  saveSettings: cmd.saveSettings,
  discoverDevices: cmd.discoverDevices,
  connectDevice: cmd.connectDevice,
  readModbusTcp: cmd.readModbusTcp,
  scanModbusTcp: cmd.scanModbusTcp,
  getAppVersion: cmd.getAppVersion,
  getLocalIp: cmd.getLocalIp,
  startSimulation: cmd.startSimulation,
  stopSimulation: cmd.stopSimulation,

  async onDiscoveryProgress(handler) {
    return listen<DiscoveryProgressEvent>('discovery-progress', (event) => {
      handler(event.payload);
    });
  },
};
