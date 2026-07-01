import React, { useEffect, useState } from 'react';
import { useSensorStore }        from '../../store/sensorStore';
import { useHealth, useSetMode } from '../../hooks/useDeviceInfo';
import { useConnectionStore }    from '../../store/connectionStore';
import { Panel }                 from '../ui/Panel';
import { formatTimestamp, formatUptime } from '../../utils/formatters';
import type { DataProtocol }     from '../../services/device/ConnectionTypes';
import { DEFAULT_MACHINE_ID }    from '../../services/device/DeviceIdentity';

// ── Sub-components ────────────────────────────────────────────────────────────

interface RowProps { label: string; children: React.ReactNode }
const Row: React.FC<RowProps> = ({ label, children }) => (
  <div className="flex items-center justify-between py-2 border-b last:border-0"
    style={{ borderColor: 'var(--border)' }}>
    <span className="text-2xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-3)' }}>
      {label}
    </span>
    <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>{children}</span>
  </div>
);

// Protocol badge ─────────────────────────────────────────────────────────────

const PROTOCOL_LABELS: Record<DataProtocol, string> = {
  'websocket':           'WebSocket',
  'modbus':              'Modbus TCP',
  'none':                '—',
};

const PROTOCOL_COLORS: Record<DataProtocol, string> = {
  'websocket':           'var(--ok)',
  'modbus':              'var(--warn)',
  'none':                'var(--text-3)',
};

function ProtocolBadge({ protocol }: { protocol: DataProtocol }) {
  const label = PROTOCOL_LABELS[protocol];
  const color = PROTOCOL_COLORS[protocol];
  return (
    <span className="font-semibold" style={{ color }}>
      {label}
    </span>
  );
}

// Connection status badge ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    connected:    { label: 'CONNECTED',    color: 'var(--ok)' },
    connecting:   { label: 'CONNECTING',   color: 'var(--warn)' },
    disconnected: { label: 'DISCONNECTED', color: 'var(--text-3)' },
    error:        { label: 'ERROR',        color: 'var(--crit)' },
  };
  const { label, color } = map[status] ?? { label: status.toUpperCase(), color: 'var(--text-3)' };
  return <span className="font-semibold tracking-widest" style={{ color }}>{label}</span>;
}

// Latency display ─────────────────────────────────────────────────────────────

function LatencyDisplay({ ms }: { ms: number }) {
  const color =
    ms === 0    ? 'var(--text-3)' :
    ms < 50     ? 'var(--ok)'     :
    ms < 200    ? 'var(--warn)'   : 'var(--crit)';
  const label = ms === 0 ? '—' : `${ms} ms`;
  return <span style={{ color }}>{label}</span>;
}

// ── Main component ─────────────────────────────────────────────────────────────

export const StatusPanel: React.FC = () => {
  const connectionStatus  = useSensorStore((s) => s.connectionStatus);
  const connectedAt       = useSensorStore((s) => s.connectedAt);
  const latest            = useSensorStore((s) => s.latest);
  const readingCount      = useSensorStore((s) => s.readings.length);
  const reconnectCount    = useSensorStore((s) => s.reconnectCount);
  const latencyMs         = useSensorStore((s) => s.latencyMs);
  const activeProtocol    = useSensorStore((s) => s.activeDataProtocol);
  const config            = useConnectionStore((s) => s.config);
  const { data: health }  = useHealth();
  const setMode           = useSetMode();
  const [modeErr, setModeErr] = useState<string | null>(null);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  const handleModeToggle = async () => {
    if (!health) return;
    const next = health.mode === 'simulated';  // toggle: sim → hw, hw → sim
    try {
      const res = await setMode.mutateAsync(!next);
      if (!res.success) setModeErr(res.message);
    } catch (err) {
      setModeErr(err instanceof Error ? err.message : 'Request failed');
    }
    setTimeout(() => setModeErr(null), 4000);
  };

  const sessionUptime = connectedAt ? formatUptime((now - connectedAt) / 1000) : '--:--:--';

  // Machine ID: from live connection config (set during discovery), else default
  const machineId = config?.machineId ?? DEFAULT_MACHINE_ID;

  return (
    <Panel title="CONNECTION STATUS">

      {/* Status */}
      <Row label="Status">
        <StatusBadge status={connectionStatus} />
      </Row>

      {/* Protocol */}
      <Row label="Protocol">
        <ProtocolBadge protocol={activeProtocol} />
      </Row>

      {/* Device name */}
      <Row label="Device">
        <span className="truncate max-w-[160px]">{config?.deviceName ?? '—'}</span>
      </Row>

      {/* Machine ID */}
      <Row label="Machine ID">
        <span style={{ color: 'var(--accent)' }}>{machineId}</span>
      </Row>

      {/* IP / Port */}
      <Row label="IP Address">
        {config?.deviceIp
          ? <span style={{ color: 'var(--text-2)' }}>{config.deviceIp}</span>
          : <span style={{ color: 'var(--text-3)' }}>—</span>}
      </Row>

      {/* Latency */}
      <Row label="Latency">
        <LatencyDisplay ms={latencyMs} />
      </Row>

      {/* Last update */}
      <Row label="Last Update">
        <span style={{ color: 'var(--text-2)' }}>
          {latest ? formatTimestamp(latest.timestamp) : '—'}
        </span>
      </Row>

      {/* Data points */}
      <Row label="Data Points">
        <span style={{ color: 'var(--accent)' }}>{readingCount.toLocaleString()}</span>
      </Row>

      {/* Reconnects */}
      <Row label="Reconnects">
        <span style={{ color: reconnectCount > 0 ? 'var(--warn)' : 'var(--ok)' }}>
          {reconnectCount}
        </span>
      </Row>

      {/* Session uptime */}
      <Row label="Session Up">{sessionUptime}</Row>

      {/* System uptime from backend health */}
      <Row label="System Up">
        {health ? formatUptime(health.uptime_seconds) : '—'}
      </Row>

      {/* Backend mode + toggle */}
      <div className="flex items-center justify-between py-2 border-b last:border-0"
        style={{ borderColor: 'var(--border)' }}>
        <span className="text-2xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-3)' }}>
          Mode
        </span>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-mono font-semibold"
            style={{ color: health?.mode === 'simulated' ? 'var(--warn)' : 'var(--ok)' }}
          >
            {health?.mode?.toUpperCase() ?? '—'}
          </span>
          {health && (
            <button
              onClick={() => { void handleModeToggle(); }}
              disabled={setMode.isPending}
              title={health.mode === 'simulated' ? 'Switch to hardware sensors' : 'Switch to simulation'}
              className="text-2xs px-1.5 py-0.5 rounded transition-colors disabled:opacity-40"
              style={{
                background: 'var(--panel-alt)',
                border: '1px solid var(--border-hi)',
                color: 'var(--text-2)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hi)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; }}
            >
              {setMode.isPending ? '…' : health.mode === 'simulated' ? 'HW' : 'SIM'}
            </button>
          )}
        </div>
      </div>

      {modeErr && (
        <div className="mt-2 rounded px-2 py-1.5 text-2xs"
          style={{ background: 'var(--warn-dim)', border: '1px solid var(--warn)', color: 'var(--warn)' }}>
          {modeErr}
        </div>
      )}
    </Panel>
  );
};
