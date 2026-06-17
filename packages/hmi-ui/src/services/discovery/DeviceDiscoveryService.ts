/**
 * DeviceDiscoveryService.ts
 * Thin facade over the Tauri device discovery commands.
 *
 * Discovery priority order (handled in Rust):
 *   1. Last-known device (from saved settings)
 *   2. mDNS / well-known hostnames (ultron-edge.local, raspberrypi.local, …)
 *   3. Local subnet scan in batches
 *   4. Manual IP entry (via connectToDevice)
 */

import type { HmiPlatform } from '@ultron/hmi-core';
import type { TauriDeviceInfo } from '../../types/tauri';

export interface DiscoveryResult {
  devices:  TauriDeviceInfo[];
  durationMs: number;
}

/**
 * Run the full auto-discovery sequence.
 * Progress events are emitted as `discovery-progress` Tauri events —
 * listen with `listen('discovery-progress', handler)` from the calling UI.
 */
export async function runDiscovery(
  platform: HmiPlatform,
  lastKnownIp?: string,
): Promise<DiscoveryResult> {
  const start   = Date.now();
  const devices = await platform.discoverDevices(lastKnownIp);
  return { devices, durationMs: Date.now() - start };
}

/**
 * Probe a single URL for an ULTRON Edge device.
 * Useful for manual IP entry.
 */
export async function connectToDevice(platform: HmiPlatform, apiBase: string): Promise<TauriDeviceInfo> {
  return platform.connectDevice(apiBase);
}

/**
 * Load the last-known device IP from persistent settings.
 * Returns null if no IP has been saved.
 */
export async function getLastKnownIp(platform: HmiPlatform): Promise<string | null> {
  try {
    const settings = await platform.getSavedSettings();
    return settings.last_device_ip;
  } catch {
    return null;
  }
}

/**
 * Persist the successfully-connected device IP for the next session.
 */
export async function saveLastKnownIp(platform: HmiPlatform, ip: string): Promise<void> {
  await platform.saveSettings({ last_device_ip: ip });
}
