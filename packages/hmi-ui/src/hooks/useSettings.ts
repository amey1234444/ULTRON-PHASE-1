/**
 * Hook for reading and writing persistent app settings via the active platform.
 */

import { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '../platform/PlatformContext';
import type { AppSettings } from '../types/tauri';

interface UseSettingsReturn {
  settings: AppSettings | null;
  loading:  boolean;
  error:    string | null;
  update:   (patch: Partial<AppSettings>) => Promise<void>;
  reload:   () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const platform = usePlatform();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await platform.getSavedSettings();
      setSettings(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => { void reload(); }, [reload]);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    try {
      const updated = await platform.saveSettings(patch);
      setSettings(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [platform]);

  return { settings, loading, error, update, reload };
}
