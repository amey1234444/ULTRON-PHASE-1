/**
 * Hook that manages the backend lifecycle from the React side.
 * The SplashPage calls this to start and monitor the backend.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlatform } from '../platform/PlatformContext';
import { useAppStore } from '../store/appStore';
import type { BackendStatus } from '../types/tauri';

interface UseBackendReturn {
  status:     BackendStatus | null;
  error:      string | null;
  startAsync: () => Promise<BackendStatus>;
  stop:       () => Promise<void>;
}

export function useBackend(): UseBackendReturn {
  const platform = usePlatform();
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [error,  setError]  = useState<string | null>(null);
  const setBackendRunning   = useAppStore((s) => s.setBackendRunning);
  const pollRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll backend health every 5 seconds while app is running
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const s = await platform.getBackendStatus();
        setStatus(s);
        setBackendRunning(s.health_ok);
      } catch { /* ignore polling errors */ }
    }, 5_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [platform, setBackendRunning]);

  const startAsync = useCallback(async (): Promise<BackendStatus> => {
    setError(null);
    try {
      const s = await platform.startBackend();
      setStatus(s);
      setBackendRunning(s.health_ok);
      return s;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    }
  }, [platform, setBackendRunning]);

  const stop = useCallback(async () => {
    await platform.stopBackend();
    setStatus(null);
    setBackendRunning(false);
  }, [platform, setBackendRunning]);

  return { status, error, startAsync, stop };
}
