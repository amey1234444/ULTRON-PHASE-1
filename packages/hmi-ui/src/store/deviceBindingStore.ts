import { create } from 'zustand';

/**
 * Device bridge bindings: maps an asset node ("device") to a bridge identity
 * (machine_id + ip + port). A reading pushed by a bridge is routed to a device
 * only when its reported machine_id AND ip both match the binding.
 */

export interface DeviceBinding {
  node_id: string;
  machine_id: string;
  ip: string;
  port: number;
  updated_at: number;
  // Runtime status from the backend
  connected: boolean;
  last_seen: number;
  last_source_ip: string | null;
  pressure: number | null;
  temperature: number | null;
}

export interface IncomingSource {
  machine_id: string;
  ip: string;
  source_ip: string | null;
  last_seen: number;
  matched_node_id: string | null;
}

interface DeviceBindingStore {
  bindings: Record<string, DeviceBinding>; // keyed by node_id
  incoming: IncomingSource[];
  loading: boolean;

  fetchBindings: (apiBase: string) => Promise<void>;
  fetchIncoming: (apiBase: string) => Promise<void>;
  saveBinding: (apiBase: string, nodeId: string, machineId: string, ip: string, port: number) => Promise<void>;
  deleteBinding: (apiBase: string, nodeId: string) => Promise<void>;
}

export const useDeviceBindingStore = create<DeviceBindingStore>((set) => ({
  bindings: {},
  incoming: [],
  loading: false,

  fetchBindings: async (apiBase) => {
    set({ loading: true });
    try {
      const res = await fetch(`${apiBase}/api/devices/bindings`);
      if (!res.ok) return;
      const list: DeviceBinding[] = await res.json();
      const map: Record<string, DeviceBinding> = {};
      for (const b of list) map[b.node_id] = b;
      set({ bindings: map });
    } catch {
      // backend unreachable — keep whatever we have
    } finally {
      set({ loading: false });
    }
  },

  fetchIncoming: async (apiBase) => {
    try {
      const res = await fetch(`${apiBase}/api/devices/incoming`);
      if (!res.ok) return;
      const list: IncomingSource[] = await res.json();
      set({ incoming: list });
    } catch {
      /* ignore */
    }
  },

  saveBinding: async (apiBase, nodeId, machineId, ip, port) => {
    const res = await fetch(`${apiBase}/api/devices/bindings/${nodeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machine_id: machineId, ip, port }),
    });
    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
    const binding: DeviceBinding = await res.json();
    set((state) => ({ bindings: { ...state.bindings, [nodeId]: binding } }));
  },

  deleteBinding: async (apiBase, nodeId) => {
    const res = await fetch(`${apiBase}/api/devices/bindings/${nodeId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error(`Delete failed: ${res.status}`);
    set((state) => {
      const next = { ...state.bindings };
      delete next[nodeId];
      return { bindings: next };
    });
  },
}));
