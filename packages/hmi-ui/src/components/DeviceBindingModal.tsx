import React, { useEffect, useState } from 'react';
import { useDeviceBindingStore } from '../store/deviceBindingStore';

interface Props {
  open: boolean;
  nodeId: string;
  nodeLabel: string;
  nodeCode?: string;
  apiBase: string;
  onClose: () => void;
}

/**
 * Per-device bridge binding editor. Lets the user map a device (asset node) to
 * a bridge identity (Machine ID + IP + Port). A pushed reading is routed to
 * this device only when its reported machine_id AND ip both match what is saved
 * here.
 */
export const DeviceBindingModal: React.FC<Props> = ({
  open, nodeId, nodeLabel, nodeCode, apiBase, onClose,
}) => {
  const binding = useDeviceBindingStore((s) => s.bindings[nodeId]);
  const incoming = useDeviceBindingStore((s) => s.incoming);
  const saveBinding = useDeviceBindingStore((s) => s.saveBinding);
  const deleteBinding = useDeviceBindingStore((s) => s.deleteBinding);
  const fetchIncoming = useDeviceBindingStore((s) => s.fetchIncoming);

  const [machineId, setMachineId] = useState('');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('8765');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMachineId(binding?.machine_id ?? nodeCode ?? '');
    setIp(binding?.ip ?? '');
    setPort(String(binding?.port ?? 8765));
    setError(null);
    fetchIncoming(apiBase);
    const id = setInterval(() => fetchIncoming(apiBase), 3000);
    return () => clearInterval(id);
  }, [open, binding, nodeCode, apiBase, fetchIncoming]);

  if (!open) return null;

  const handleSave = async () => {
    if (!machineId.trim()) { setError('Machine ID is required'); return; }
    setBusy(true);
    setError(null);
    try {
      await saveBinding(apiBase, nodeId, machineId.trim(), ip.trim(), Number(port) || 8765);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
    setBusy(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteBinding(apiBase, nodeId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
    setBusy(false);
  };

  const inputStyle = {
    background: 'var(--panel-alt)', border: '1px solid var(--border)', color: 'var(--text)',
  } as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="rounded-lg p-6 w-full max-w-lg shadow-xl" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>
          Bridge Binding — {nodeLabel}
        </h3>
        <p className="text-2xs mb-4 leading-relaxed" style={{ color: 'var(--text-3)' }}>
          Enter the <b>Machine ID</b>, <b>IP</b> and <b>Port</b> reported by the bridge for this
          device. A pushed reading routes here only when its machine id <i>and</i> ip both match.
          Start the bridge with <code>--push-url &lt;backend&gt; --machine-id {machineId || 'ID'} --ip {ip || '&lt;ip&gt;'}</code>.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-2)' }}>Machine ID</label>
            <input value={machineId} onChange={(e) => setMachineId(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm outline-none font-mono" style={inputStyle}
              autoFocus placeholder="e.g. RAV-01" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-2)' }}>IP Address</label>
              <input value={ip} onChange={(e) => setIp(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm outline-none font-mono" style={inputStyle}
                placeholder="e.g. 192.168.1.50" />
            </div>
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-2)' }}>Port</label>
              <input value={port} onChange={(e) => setPort(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm outline-none font-mono" style={inputStyle}
                placeholder="8765" />
            </div>
          </div>
        </div>

        {binding && (
          <div className="mt-3 rounded px-3 py-2 text-2xs" style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
            <span style={{ color: binding.connected ? 'var(--ok, #22c55e)' : 'var(--text-3)' }}>
              {binding.connected ? '● RECEIVING' : '○ no data'}
            </span>
            {binding.last_source_ip && <span className="ml-3">source IP: {binding.last_source_ip}</span>}
            {binding.pressure != null && <span className="ml-3">P {binding.pressure} bar</span>}
            {binding.temperature != null && <span className="ml-3">T {binding.temperature} °C</span>}
          </div>
        )}

        {incoming.length > 0 && (
          <div className="mt-3">
            <div className="text-2xs mb-1 font-medium" style={{ color: 'var(--text-3)' }}>Incoming bridges (click to fill):</div>
            <div className="flex flex-col gap-1 max-h-28 overflow-auto">
              {incoming.map((src) => (
                <button key={`${src.machine_id}@${src.ip}`}
                  onClick={() => { setMachineId(src.machine_id); setIp(src.ip); }}
                  className="text-left px-2 py-1 rounded text-2xs font-mono"
                  style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                  {src.machine_id} @ {src.ip || '(no ip)'}
                  {src.matched_node_id ? ' · matched' : ' · unmatched'}
                  {src.source_ip ? ` · from ${src.source_ip}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-2xs" style={{ color: '#ef4444' }}>{error}</p>}

        <div className="flex gap-2 mt-5 justify-between">
          <div>
            {binding && (
              <button onClick={handleDelete} disabled={busy}
                className="px-4 py-2 rounded text-xs font-medium"
                style={{ background: 'var(--panel-alt)', color: '#ef4444', border: '1px solid var(--border)' }}>
                Remove
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={busy}
              className="px-4 py-2 rounded text-xs font-medium"
              style={{ background: 'var(--panel-alt)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={busy || !machineId.trim()}
              className="px-4 py-2 rounded text-xs font-medium"
              style={{ background: 'var(--accent)', color: '#fff', opacity: machineId.trim() ? 1 : 0.5 }}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
