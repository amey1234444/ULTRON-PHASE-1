import React, { useEffect, useState } from 'react';
import { useAppStore }        from '../store/appStore';
import { useConnectionStore } from '../store/connectionStore';
import { useSensorStore }     from '../store/sensorStore';
import { formatUptime }       from '../utils/formatters';
import { usePlatform }        from '../platform/PlatformContext';
import type { BackendStatus, ModbusTarget } from '../types/tauri';

interface RowProps { label: string; value: React.ReactNode; mono?: boolean }
const Row: React.FC<RowProps> = ({ label, value, mono }) => (
  <div className="flex items-center justify-between py-2.5 border-b last:border-0"
    style={{ borderColor: 'var(--border)' }}>
    <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{label}</span>
    <span className={`text-xs ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text)' }}>{value}</span>
  </div>
);

interface SectionProps { title: string; children: React.ReactNode; actions?: React.ReactNode }
const Section: React.FC<SectionProps> = ({ title, children, actions }) => (
  <div className="scada-panel mb-4">
    <div className="scada-panel-header">
      <span className="scada-panel-title">{title}</span>
      {actions}
    </div>
    <div className="p-3">{children}</div>
  </div>
);

interface Props { onBack?: () => void }

export const DiagnosticsPage: React.FC<Props> = ({ onBack }) => {
  const platform         = usePlatform();
  const goBack           = useAppStore((s) => s.goBack);
  const config           = useConnectionStore((s) => s.config);
  const connectionStatus = useSensorStore((s) => s.connectionStatus);
  const reconnectCount   = useSensorStore((s) => s.reconnectCount);
  const readings         = useSensorStore((s) => s.readings);
  const latest           = useSensorStore((s) => s.latest);
  const connectedAt      = useSensorStore((s) => s.connectedAt);

  const [backendStatus,  setBackendStatus]  = useState<BackendStatus | null>(null);
  const [modbusTargets,  setModbusTargets]  = useState<ModbusTarget[]>([]);
  const [scanningModbus, setScanningModbus] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    platform.getBackendStatus().then(setBackendStatus).catch(() => {});
  }, [platform]);

  const scanModbus = async () => {
    setScanningModbus(true);
    try { setModbusTargets(await (platform.scanModbusTcp?.(config?.deviceIp) ?? Promise.resolve([]))); }
    catch {} finally { setScanningModbus(false); }
  };

  const sessionUptime = connectedAt ? formatUptime((now - connectedAt) / 1000) : '—';
  const handleBack = onBack ?? goBack;

  const connStatusColor: Record<string, string> = {
    connected: 'var(--ok)', connecting: 'var(--warn)',
    disconnected: 'var(--text-3)', error: 'var(--crit)',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Inner header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}>
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <span className="text-sm font-bold tracking-widest uppercase" style={{ color: 'var(--text)' }}>Diagnostics</span>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-4 max-w-2xl w-full mx-auto">

        <Section title="CONNECTION">
          <Row label="WebSocket" value={
            <span style={{ color: connStatusColor[connectionStatus] ?? 'var(--text-3)' }}>
              {connectionStatus.toUpperCase()}
            </span>
          } />
          <Row label="Protocol"     value={config?.protocol?.toUpperCase() ?? '—'} />
          <Row label="Device"       value={config?.deviceName ?? '—'} />
          <Row label="Device IP"    value={config?.deviceIp ?? '—'} mono />
          <Row label="API Base"     value={config?.apiBase ?? '—'} mono />
          <Row label="WS URL"       value={config?.wsUrl ?? '—'} mono />
          <Row label="Modbus port"  value={String(config?.modbusPort ?? '—')} mono />
          <Row label="Session up"   value={sessionUptime} mono />
          <Row label="Reconnects"   value={
            <span style={{ color: reconnectCount > 0 ? 'var(--warn)' : 'var(--ok)' }}>
              {reconnectCount}
            </span>
          } />
          <Row label="Data points"  value={readings.length.toLocaleString()} mono />
          <Row label="Last reading" value={latest?.timestamp ?? '—'} mono />
        </Section>

        <Section title="BACKEND">
          {backendStatus ? (
            <>
              <Row label="Status" value={
                <span style={{ color: backendStatus.health_ok ? 'var(--ok)' : 'var(--crit)' }}>
                  {backendStatus.running ? 'Running' : 'Stopped'}
                </span>
              } />
              <Row label="Port"     value={String(backendStatus.port)} mono />
              <Row label="PID"      value={String(backendStatus.pid ?? '—')} mono />
              <Row label="External" value={backendStatus.external ? 'Yes' : 'No'} />
              <Row label="Uptime"   value={
                backendStatus.uptime_secs != null ? formatUptime(backendStatus.uptime_secs) : '—'
              } mono />
            </>
          ) : (
            <p className="text-xs py-1" style={{ color: 'var(--text-3)' }}>Loading…</p>
          )}
        </Section>

        <Section title="MODBUS TCP SCAN" actions={
          <button
            onClick={scanModbus}
            disabled={scanningModbus}
            className="text-2xs font-semibold px-2 py-0.5 rounded border transition-colors disabled:opacity-40"
            style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            {scanningModbus ? 'Scanning…' : 'Scan Now'}
          </button>
        }>
          {modbusTargets.length === 0 && !scanningModbus && (
            <p className="text-xs py-1" style={{ color: 'var(--text-3)' }}>
              Click Scan Now to probe Modbus TCP ports.
            </p>
          )}
          {modbusTargets.map((t, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0"
              style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>
                {t.host}:{t.port}
              </span>
              <span className="text-xs font-semibold"
                style={{ color: t.reachable ? 'var(--ok)' : 'var(--text-3)' }}>
                {t.reachable ? '● OPEN' : '○ CLOSED'}
              </span>
            </div>
          ))}
        </Section>

      </div>
    </div>
  );
};
