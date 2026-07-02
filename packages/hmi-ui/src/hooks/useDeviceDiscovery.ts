/**
 * ULTRON Device Discovery Hook (Tauri version)
 * ==============================================
 * Wraps the active platform's device discovery implementation and manages
 * the discovery lifecycle.
 *
 * State machine:
 *   idle → checking-cache → probing → found-single | found-multiple | not-found
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlatform } from '../platform/PlatformContext';
import { useConnectionStore, deviceInfoToConfig } from '../store/connectionStore';
import { useAppStore } from '../store/appStore';
import type { TauriDeviceInfo } from '../types/tauri';
import type { AppSettings } from '../types/tauri';

export type DiscoveryState =
  | 'idle'
  | 'checking-cache'
  | 'probing'
  | 'found-single'
  | 'found-multiple'
  | 'not-found';

export interface UseDeviceDiscoveryReturn {
  state:           DiscoveryState;
  progress:        string;
  devices:         TauriDeviceInfo[];
  connectTo:       (device: TauriDeviceInfo) => void;
  retry:           () => void;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function useDeviceDiscovery(): UseDeviceDiscoveryReturn {
  const platform = usePlatform();
  const [state,    setState]    = useState<DiscoveryState>('idle');
  const [progress, setProgress] = useState('Initialising…');
  const [devices,  setDevices]  = useState<TauriDeviceInfo[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const setConfig  = useConnectionStore((s) => s.setConfig);
  const setAppPhase = useAppStore((s) => s.setAppPhase);

  const unlistenRef = useRef<(() => void) | null>(null);

  // Load saved settings once on mount
  useEffect(() => {
    platform.getSavedSettings()
      .then(setSettings)
      .catch(() => { /* use null */ });
  }, [platform]);

  // ── Connect to a specific device ──────────────────────────────────────────

  const connectTo = useCallback((device: TauriDeviceInfo) => {
    const cfg = deviceInfoToConfig(device);
    // Persist the last-known IP for future sessions
    platform.saveSettings({ last_device_ip: cfg.deviceIp }).catch(() => { /* non-fatal */ });
    setConfig(cfg);
    setAppPhase('connected');
  }, [platform, setConfig, setAppPhase]);

  // ── Run full discovery sequence ────────────────────────────────────────────

  const run = useCallback(async () => {
    // Subscribe to progress events from Rust
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    if (platform.onDiscoveryProgress) {
      const unlisten = await platform.onDiscoveryProgress((event) => {
        setProgress(event.message);
      });
      unlistenRef.current = unlisten;
    }

    // ── Step 1: Last-known IP from saved settings ─────────────────────────
    setState('checking-cache');
    setProgress('Checking last known device…');

    const lastIp = settings?.last_device_ip ?? null;

    // ── Step 2: Full Tauri discovery ──────────────────────────────────────
    setState('probing');
    setProgress('Searching for ULTRON Edge devices…');

    let found: TauriDeviceInfo[] = [];
    try {
      found = await platform.discoverDevices(lastIp ?? undefined);
    } catch (err) {
      console.warn('Discovery error:', err);
    }

    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }

    if (found.length === 0) {
      setState('not-found');
      setProgress('No ULTRON Edge device found on this network.');
      return;
    }

    if (found.length === 1) {
      setState('found-single');
      setProgress(`Found: ${found[0].device_name} — connecting…`);
      await delay(600);
      connectTo(found[0]);
      return;
    }

    setDevices(found);
    setState('found-multiple');
    setProgress(`Found ${found.length} ULTRON devices — select one to connect.`);
  }, [platform, settings, connectTo]);

  // ── Retry ─────────────────────────────────────────────────────────────────

  const retry = useCallback(() => {
    setState('idle');
    setDevices([]);
    setProgress('Restarting discovery…');
    setTimeout(run, 100);
  }, [run]);

  // ── Auto-start ────────────────────────────────────────────────────────────

  useEffect(() => {
    // Wait briefly for settings to load before scanning
    const t = setTimeout(run, 200);
    return () => {
      clearTimeout(t);
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, progress, devices, connectTo, retry };
}
