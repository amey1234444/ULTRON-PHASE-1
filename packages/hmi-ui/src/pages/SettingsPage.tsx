import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAssetHierarchyStore } from '../store/assetHierarchyStore';
import { useConnectionStore }     from '../store/connectionStore';
import { useSensorStore }         from '../store/sensorStore';

interface BridgeEntry {
  id: string;
  url: string;
  equipmentTypeId: string;
  status: string;
  lastSeen: number;
  lastError: string | null;
  registeredAt: number;
  pollCount: number;
  errorCount: number;
  hasData: boolean;
}

interface Props { onBack?: () => void }

export const SettingsPage: React.FC<Props> = ({ onBack }) => {
  const config = useConnectionStore((s) => s.config);
  const apiBase = config?.apiBase ?? import.meta.env.VITE_API_BASE ?? '';

  const tree = useAssetHierarchyStore((s) => s.tree);
  const fetchTree = useAssetHierarchyStore((s) => s.fetchTree);
  const selectedEquipmentTypeId = useAssetHierarchyStore((s) => s.selectedEquipmentTypeId);

  const [bridges, setBridges] = useState<BridgeEntry[]>([]);
  const [bridgeUrl, setBridgeUrl] = useState('');
  const [selectedEquip, setSelectedEquip] = useState(selectedEquipmentTypeId ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Collect all equipment types from tree
  const equipmentTypes: { id: string; label: string; bridgeUrl: string; path: string }[] = [];
  function collectEquipTypes(nodes: typeof tree, pathParts: string[] = []) {
    for (const n of nodes) {
      if (n.level === 'equipmentType') {
        equipmentTypes.push({
          id: n.id,
          label: n.label,
          bridgeUrl: n.bridge_url ?? '',
          path: [...pathParts, n.label].join(' > '),
        });
      }
      if (n.children) collectEquipTypes(n.children, [...pathParts, n.label]);
    }
  }
  collectEquipTypes(tree);

  // Fetch bridge list
  const fetchBridges = useCallback(async () => {
    if (!apiBase) return;
    try {
      const res = await fetch(`${apiBase}/api/bridges`);
      if (res.ok) {
        const body = await res.json();
        setBridges(body.bridges ?? []);
      }
    } catch { /* silent */ }
  }, [apiBase]);

  useEffect(() => {
    void fetchBridges();
    pollRef.current = setInterval(() => { void fetchBridges(); }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchBridges]);

  useEffect(() => {
    if (selectedEquipmentTypeId) setSelectedEquip(selectedEquipmentTypeId);
  }, [selectedEquipmentTypeId]);

  // Load bridge URL from selected equipment type
  useEffect(() => {
    const equip = equipmentTypes.find((e) => e.id === selectedEquip);
    if (equip) setBridgeUrl(equip.bridgeUrl);
  }, [selectedEquip]);

  const handleSaveBridge = async () => {
    if (!selectedEquip) { setMessage({ text: 'Select an equipment type', ok: false }); return; }
    const url = bridgeUrl.trim();
    setSaving(true);
    setMessage(null);
    try {
      // Save bridge URL to asset hierarchy
      const res = await fetch(`${apiBase}/api/assets/${selectedEquip}/bridge`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridge_url: url }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Also register with bridge manager if URL is provided
      if (url) {
        await fetch(`${apiBase}/api/bridges/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.startsWith('http') ? url : `http://${url}`, equipment_type_id: selectedEquip }),
        });
      }

      setMessage({ text: url ? 'Bridge configured and polling started' : 'Bridge URL removed', ok: true });
      await fetchTree(apiBase);
      void fetchBridges();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Failed to save', ok: false });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleRemoveBridge = async (equipId: string) => {
    try {
      await fetch(`${apiBase}/api/assets/${equipId}/bridge`, { method: 'DELETE' });
      await fetchTree(apiBase);
      void fetchBridges();
      if (equipId === selectedEquip) setBridgeUrl('');
    } catch { /* silent */ }
  };

  const handleUnregisterBridge = async (bridgeId: string) => {
    try {
      await fetch(`${apiBase}/api/bridges/${bridgeId}`, { method: 'DELETE' });
      void fetchBridges();
    } catch { /* silent */ }
  };

  const statusColor = (s: string) => {
    if (s === 'connected') return 'text-green-400';
    if (s === 'error') return 'text-red-400';
    return 'text-yellow-400';
  };

  const ago = (ts: number) => {
    if (!ts) return 'never';
    const diff = Math.round((Date.now() / 1000) - ts);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    return `${Math.round(diff / 60)}m ago`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0f1419] overflow-auto">
      <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* Equipment Bridge Configuration */}
        <section className="bg-[#1a1f2e] rounded-lg border border-gray-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-700/50">
            <h2 className="text-sm font-bold tracking-wider text-white uppercase">Bridge Configuration</h2>
            <p className="text-xs text-gray-400 mt-1">
              Configure bridge IP:port for each equipment type. The backend will poll the bridge&apos;s
              <code className="text-green-400 mx-1">/api/live</code> endpoint every 1s and display
              data for the selected equipment.
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Equipment Type Selector */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1 block">
                  Equipment Type
                </label>
                <select
                  value={selectedEquip}
                  onChange={(e) => setSelectedEquip(e.target.value)}
                  className="w-full bg-[#0f1419] border border-gray-600 text-white text-sm rounded px-3 py-2 outline-none focus:border-green-400"
                >
                  <option value="">Select equipment type...</option>
                  {equipmentTypes.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.label} {et.bridgeUrl ? `(${et.bridgeUrl})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bridge URL Input */}
            <div>
              <label className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1 block">
                Bridge URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={bridgeUrl}
                  onChange={(e) => setBridgeUrl(e.target.value)}
                  placeholder="http://192.168.1.100:8765"
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveBridge(); }}
                  className="flex-1 bg-[#0f1419] border border-gray-600 text-white text-sm rounded px-3 py-2 font-mono outline-none focus:border-green-400 placeholder-gray-500"
                />
                <button
                  onClick={() => { void handleSaveBridge(); }}
                  disabled={saving || !selectedEquip}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {/* Status message */}
            {message && (
              <div className={`rounded px-3 py-2 text-xs border ${message.ok ? 'bg-green-900/20 border-green-600 text-green-400' : 'bg-red-900/20 border-red-600 text-red-400'}`}>
                {message.text}
              </div>
            )}
          </div>
        </section>

        {/* Configured Bridges Table */}
        <section className="bg-[#1a1f2e] rounded-lg border border-gray-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-700/50">
            <h2 className="text-sm font-bold tracking-wider text-white uppercase">Equipment Bridges</h2>
            <p className="text-xs text-gray-400 mt-1">
              All equipment types with configured bridge URLs.
            </p>
          </div>
          <div className="p-5">
            {equipmentTypes.filter((et) => et.bridgeUrl).length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                No bridges configured. Select an equipment type above and enter a bridge URL.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-2 text-gray-400 font-semibold">Equipment</th>
                      <th className="text-left py-2 px-2 text-gray-400 font-semibold">Bridge URL</th>
                      <th className="text-center py-2 px-2 text-gray-400 font-semibold">Status</th>
                      <th className="text-center py-2 px-2 text-gray-400 font-semibold">Polls</th>
                      <th className="text-center py-2 px-2 text-gray-400 font-semibold">Last Seen</th>
                      <th className="text-right py-2 px-2 text-gray-400 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipmentTypes.filter((et) => et.bridgeUrl).map((et) => {
                      const bridge = bridges.find((b) => b.equipmentTypeId === et.id);
                      return (
                        <tr key={et.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                          <td className="py-2 px-2 text-white font-medium">{et.label}</td>
                          <td className="py-2 px-2 font-mono text-green-400">{et.bridgeUrl}</td>
                          <td className={`py-2 px-2 text-center font-semibold ${bridge ? statusColor(bridge.status) : 'text-gray-500'}`}>
                            {bridge ? bridge.status.toUpperCase() : 'PENDING'}
                          </td>
                          <td className="py-2 px-2 text-center text-gray-300">{bridge?.pollCount ?? 0}</td>
                          <td className="py-2 px-2 text-center text-gray-400">{bridge ? ago(bridge.lastSeen) : '—'}</td>
                          <td className="py-2 px-2 text-right">
                            <button
                              onClick={() => { void handleRemoveBridge(et.id); }}
                              className="text-red-400 hover:text-red-300 font-semibold"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Active Bridges (all registered, including non-equipment ones) */}
        {bridges.length > 0 && (
          <section className="bg-[#1a1f2e] rounded-lg border border-gray-700/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-700/50">
              <h2 className="text-sm font-bold tracking-wider text-white uppercase">Active Polling</h2>
              <p className="text-xs text-gray-400 mt-1">
                All bridges currently being polled by the backend.
              </p>
            </div>
            <div className="p-5 space-y-2">
              {bridges.map((b) => (
                <div key={b.id} className="flex items-center justify-between bg-[#0f1419] rounded px-3 py-2 border border-gray-700/50">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-white truncate">{b.url}</div>
                    <div className="flex gap-3 mt-0.5 text-[10px] text-gray-400">
                      <span className={statusColor(b.status)}>{b.status.toUpperCase()}</span>
                      <span>polls: {b.pollCount}</span>
                      {b.errorCount > 0 && <span className="text-red-400">errors: {b.errorCount}</span>}
                      <span>seen: {ago(b.lastSeen)}</span>
                      {b.equipmentTypeId && <span className="text-blue-400">equip: {b.equipmentTypeId}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => { void handleUnregisterBridge(b.id); }}
                    className="text-[10px] px-2 py-1 bg-red-900/30 text-red-400 border border-red-700/50 rounded font-semibold hover:bg-red-900/50"
                  >
                    Stop
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
};
