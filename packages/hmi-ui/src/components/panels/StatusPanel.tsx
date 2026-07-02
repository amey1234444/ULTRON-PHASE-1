import React, { useEffect, useState } from 'react';
import { useSensorStore }        from '../../store/sensorStore';
import { useHealth }             from '../../hooks/useDeviceInfo';
import { useConnectionStore }    from '../../store/connectionStore';
import { Panel }                 from '../ui/Panel';
import { formatTimestamp, formatUptime } from '../../utils/formatters';
import type { DataProtocol }     from '../../services/device/ConnectionTypes';
import { DEFAULT_MACHINE_ID }    from '../../services/device/DeviceIdentity';

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// Protocol badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PROTOCOL_LABELS: Record<DataProtocol, string> = {
  'websocket':           'WebSocket',
  'modbus':              'Modbus TCP',
  'none':                'â€”',
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

// Connection status badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// Latency display â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function LatencyDisplay({ ms }: { ms: number }) {
  const color =
    ms === 0    ? 'var(--text-3)' :
    ms < 50     ? 'var(--ok)'     :
    ms < 200    ? 'var(--warn)'   : 'var(--crit)';
  const label = ms === 0 ? 'â€”' : `${ms} ms`;
  return <span style={{ color }}>{label}</span>;
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);


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
        <span className="truncate max-w-[160px]">{config?.deviceName ?? 'â€”'}</span>
      </Row>

      {/* Machine ID */}
      <Row label="Machine ID">
        <span style={{ color: 'var(--accent)' }}>{machineId}</span>
      </Row>

      {/* IP / Port */}
      <Row label="IP Address">
        {config?.deviceIp
          ? <span style={{ color: 'var(--text-2)' }}>{config.deviceIp}</span>
          : <span style={{ color: 'var(--text-3)' }}>â€”</span>}
      </Row>

      {/* Latency */}
      <Row label="Latency">
        <LatencyDisplay ms={latencyMs} />
      </Row>

      {/* Last update */}
      <Row label="Last Update">
        <span style={{ color: 'var(--text-2)' }}>
          {latest ? formatTimestamp(latest.timestamp) : 'â€”'}
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
        {health ? formatUptime(health.uptime_seconds) : 'â€”'}
      </Row>

      <Row label="Backend Source">
        <span className="font-semibold tracking-widest" style={{ color: 'var(--ok)' }}>
          {health?.mode === 'hardware' ? 'BRIDGE + HARDWARE' : 'BRIDGE'}
        </span>
      </Row>

    </Panel>
  );
};
