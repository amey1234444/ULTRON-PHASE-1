import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConnectionStore } from '../store/connectionStore';
import type { DeviceInfo, HealthInfo } from '../types/sensor';

function useApiBase(): string {
  return useConnectionStore((s) => s.config?.apiBase ?? 'http://localhost:8000');
}

async function get<T>(base: string, path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function useDeviceInfo() {
  const apiBase = useApiBase();
  return useQuery<DeviceInfo>({
    queryKey:  ['device', apiBase],
    queryFn:   () => get<DeviceInfo>(apiBase, '/device'),
    staleTime: Infinity,
    retry:     2,
  });
}

export function useHealth() {
  const apiBase = useApiBase();
  return useQuery<HealthInfo>({
    queryKey:        ['health', apiBase],
    queryFn:         () => get<HealthInfo>(apiBase, '/health'),
    refetchInterval: 5_000,
    retry:           false,
  });
}

interface ModeChangeResult {
  success: boolean;
  mode:    string;  // 'simulated' | 'hardware'
  message: string;
}

/**
 * Mutation to switch the backend between simulated and hardware sensor mode.
 * Invalidates the /health query on success so the UI refreshes immediately.
 */
export function useSetMode() {
  const apiBase     = useApiBase();
  const queryClient = useQueryClient();

  return useMutation<ModeChangeResult, Error, boolean>({
    mutationFn: async (simulated: boolean): Promise<ModeChangeResult> => {
      const res = await fetch(`${apiBase}/api/control/mode`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ simulated }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      return res.json() as Promise<ModeChangeResult>;
    },
    onSettled: () => {
      // Refresh the health query regardless of success/failure
      void queryClient.invalidateQueries({ queryKey: ['health', apiBase] });
    },
  });
}
