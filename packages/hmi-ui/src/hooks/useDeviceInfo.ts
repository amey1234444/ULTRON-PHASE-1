import { useQuery } from '@tanstack/react-query';
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
