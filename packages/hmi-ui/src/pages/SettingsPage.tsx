import React, { useEffect, useState } from 'react';
import { useAppStore }       from '../store/appStore';
import { useSettings }       from '../hooks/useSettings';
import { useBackend }        from '../hooks/useBackend';
import { useHealth, useSetMode } from '../hooks/useDeviceInfo';
import { useThresholdStore } from '../store/thresholdStore';
import { useConnectionStore, deviceInfoToConfig } from '../store/connectionStore';
import type { ConnectionProtocol } from '../store/connectionStore';
import { usePlatform } from '../platform/PlatformContext';
import type { SensorThresholds, HealthThresholds } from '../store/thresholdStore';

interface RowProps { label: string; children: React.ReactNode }
const Row: React.FC<RowProps> = ({ label, children }) => (
  <div className="flex items-center justify-between py-2.5 border-b last:border-0"
    style={{ borderColor: 'var(--border)' }}>
    <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{label}</span>
    <div className="text-sm" style={{ color: 'var(--text)' }}>{children}</div>
  </div>
);

interface SectionProps { title: string; children: React.ReactNode }
const Section: React.FC<SectionProps> = ({ title, children }) => (
  <div className="scada-panel mb-4">
    <div className="scada-panel-header">
      <span className="scada-panel-title">{title}</span>
    </div>
    <div className="p-3">{children}</div>
  </div>
);

interface ToggleProps { checked: boolean; onChange: (v: boolean) => void }
const Toggle: React.FC<ToggleProps> = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className="relative w-9 h-5 rounded-full transition-colors"
    style={{ background: checked ? 'var(--accent)' : 'var(--border-hi)' }}
  >
    <span
      className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
      style={{ background: 'white', left: checked ? '18px' : '2px' }}
    />
  </button>
);

const inputClass = {
  background: 'var(--panel-alt)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: '2px',
  padding: '2px 8px',
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: '0.8125rem',
  outline: 'none',
} as React.CSSProperties;

interface Props { onBack?: () => void }

export const SettingsPage: React.FC<Props> = ({ onBack }) => {
  const platform      = usePlatform();
  const goBack        = useAppStore((s) => s.goBack);
  const appVersion    = useAppStore((s) => s.appVersion);
  const { settings, loading, update } = useSettings();
  const { status: backendStatus, startAsync, stop } = useBackend();
  const { data: health }                            = useHealth();
  const setMode                                     = useSetMode();
  const setConfig     = useConnectionStore((s) => s.setConfig);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [modeMsg, setModeMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [ipDraft, setIpDraft] = useState('');
  const [connectMsg, setConnectMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (settings && !ipDraft) setIpDraft(settings.last_device_ip ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.last_device_ip]);

  const pt            = useThresholdStore((s) => s.pressure);
  const tt            = useThresholdStore((s) => s.temperature);
  const ht            = useThresholdStore((s) => s.health);
  const setPressure    = useThresholdStore((s) => s.setPressure);
  const setTemperature = useThresholdStore((s) => s.setTemperature);
  const setHealth      = useThresholdStore((s) => s.setHealth);

  const [pDraft, setPDraft] = useState<SensorThresholds>(pt);
  const [tDraft, setTDraft] = useState<SensorThresholds>(tt);
  const [hDraft, setHDraft] = useState<HealthThresholds>(ht);

  const handleUpdate = async (patch: Parameters<typeof update>[0]) => {
    setSaving(true);
    try { await update(patch); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    finally { setSaving(false); }
  };

  const handleSetMode = async (simulated: boolean) => {
    setModeMsg(null);
    try {
      const result = await setMode.mutateAsync(simulated);
      setModeMsg({ text: result.message, ok: result.success });
    } catch (err) {
      setModeMsg({ text: err instanceof Error ? err.message : 'Request failed', ok: false });
    }
    setTimeout(() => setModeMsg(null), 4000);
  };

  const handleConnect = async () => {
    const ip = ipDraft.trim();
    if (!ip) { setConnectMsg({ text: 'Enter a device IP address', ok: false }); return; }
    setConnecting(true);
    setConnectMsg(null);
    try {
      const port = settings?.last_device_port ?? 8000;
      await update({ last_device_ip: ip });
      const apiBase = `http://${ip}:${port}`;
      const device  = await platform.connectDevice(apiBase);
      const cfg     = deviceInfoToConfig(device, (settings?.preferred_protocol ?? 'lan') as ConnectionProtocol);
      setConfig(cfg);
      setConnectMsg({ text: `Connected to ${device.device_name} at ${ip}`, ok: true });
    } catch (err) {
      setConnectMsg({ text: err instanceof Error ? err.message : 'Connection failed', ok: false });
    } finally {
      setConnecting(false);
      setTimeout(() => setConnectMsg(null), 6000);
    }
  };

  const handleBack = onBack ?? goBack;

  if (loading || !settings) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-3)' }}>
        <span className="text-sm">Loading settings…</span>
      </div>
    );
  }

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
        <span className="text-sm font-bold tracking-widest uppercase" style={{ color: 'var(--text)' }}>Settings</span>
        {saved  && <span className="ml-auto text-xs font-semibold" style={{ color: 'var(--ok)' }}>✓ Saved</span>}
        {saving && <span className="ml-auto text-xs" style={{ color: 'var(--warn)' }}>Saving…</span>}
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-2xl w-full mx-auto">

        <Section title="BACKEND SERVICE">
          <Row label="Status">
            <span style={{ color: backendStatus?.health_ok ? 'var(--ok)' : 'var(--crit)' }}>
              {backendStatus?.health_ok ? 'Running' : 'Stopped'}
              {backendStatus?.external && ' (external)'}
            </span>
          </Row>
          <Row label="Port">
            <span className="font-mono text-xs">{settings.last_backend_port}</span>
          </Row>
          <Row label="Auto-start on launch">
            <Toggle checked={settings.backend_auto_start}
              onChange={(v) => handleUpdate({ backend_auto_start: v })} />
          </Row>
          <div className="flex gap-2 mt-3">
            <button onClick={() => startAsync().catch(() => {})}
              className="flex-1 rounded px-3 py-2 text-sm font-semibold transition-colors"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
              Start
            </button>
            <button onClick={() => stop().catch(() => {})}
              className="flex-1 rounded px-3 py-2 text-sm font-medium transition-colors"
              style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              Stop
            </button>
          </div>
        </Section>

        {/* ── Data Source ──────────────────────────────────────────────────── */}
        <Section title="DATA SOURCE">
          <Row label="Active Mode">
            {health ? (
              <span
                className="font-semibold tracking-widest text-xs"
                style={{ color: health.mode === 'simulated' ? 'var(--warn)' : 'var(--ok)' }}
              >
                {health.mode === 'simulated' ? 'SIMULATION' : 'HARDWARE'}
              </span>
            ) : (
              <span style={{ color: 'var(--text-3)' }}>—</span>
            )}
          </Row>

          <p className="text-2xs mt-2 mb-3 leading-relaxed" style={{ color: 'var(--text-3)' }}>
            Switch the backend between its built-in simulator and real GPIO/I2C hardware sensors.
            Switching to hardware will fail gracefully if the Pi drivers are not available,
            leaving simulation active.
          </p>

          {modeMsg && (
            <div
              className="rounded px-3 py-2 text-xs mb-3"
              style={{
                background: modeMsg.ok ? 'var(--ok-dim, rgba(32,208,104,0.08))' : 'var(--warn-dim)',
                border: `1px solid ${modeMsg.ok ? 'var(--ok)' : 'var(--warn)'}`,
                color: modeMsg.ok ? 'var(--ok)' : 'var(--warn)',
              }}
            >
              {modeMsg.text}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { void handleSetMode(false); }}
              disabled={setMode.isPending || health?.mode === 'hardware'}
              className="flex-1 rounded px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
              style={{
                background: health?.mode === 'hardware' ? 'var(--ok-dim, rgba(32,208,104,0.12))' : 'var(--panel-alt)',
                border: `1px solid ${health?.mode === 'hardware' ? 'var(--ok)' : 'var(--border)'}`,
                color: health?.mode === 'hardware' ? 'var(--ok)' : 'var(--text-2)',
              }}
            >
              {health?.mode === 'hardware' ? '✓ Hardware' : 'Use Hardware'}
            </button>
            <button
              onClick={() => { void handleSetMode(true); }}
              disabled={setMode.isPending || health?.mode === 'simulated'}
              className="flex-1 rounded px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40"
              style={{
                background: health?.mode === 'simulated' ? 'var(--warn-dim)' : 'var(--panel-alt)',
                border: `1px solid ${health?.mode === 'simulated' ? 'var(--warn)' : 'var(--border)'}`,
                color: health?.mode === 'simulated' ? 'var(--warn)' : 'var(--text-2)',
              }}
            >
              {health?.mode === 'simulated' ? '✓ Simulation' : 'Use Simulation'}
            </button>
          </div>
        </Section>

        <Section title="DEVICE CONNECTION">
          <Row label="Device IP">
            <input
              type="text"
              value={ipDraft}
              onChange={(e) => setIpDraft(e.target.value)}
              placeholder="192.168.1.x"
              style={{ ...inputClass, width: 148 }}
            />
          </Row>
          <Row label="API port">
            <input type="number" value={settings.last_device_port}
              onChange={(e) => handleUpdate({ last_device_port: +e.target.value })}
              style={{ ...inputClass, width: 80, textAlign: 'center' }} />
          </Row>
          <Row label="Modbus TCP port">
            <input type="number" value={settings.last_modbus_tcp_port}
              onChange={(e) => handleUpdate({ last_modbus_tcp_port: +e.target.value })}
              style={{ ...inputClass, width: 80, textAlign: 'center' }} />
          </Row>
          <Row label="Preferred protocol">
            <select value={settings.preferred_protocol}
              onChange={(e) => handleUpdate({ preferred_protocol: e.target.value })}
              style={{ ...inputClass, width: 'auto', padding: '2px 6px' }}>
              <option value="lan">LAN / Ethernet</option>
              <option value="wifi">Wi-Fi</option>
              <option value="manual">Manual IP</option>
              <option value="simulation">Simulation</option>
            </select>
          </Row>

          {connectMsg && (
            <div className="rounded px-3 py-2 text-xs mt-3"
              style={{
                background: connectMsg.ok ? 'var(--ok-dim, rgba(32,208,104,0.08))' : 'var(--warn-dim)',
                border: `1px solid ${connectMsg.ok ? 'var(--ok)' : 'var(--warn)'}`,
                color: connectMsg.ok ? 'var(--ok)' : 'var(--warn)',
              }}>
              {connectMsg.text}
            </div>
          )}

          <button
            onClick={() => { void handleConnect(); }}
            disabled={connecting || !ipDraft.trim()}
            className="w-full mt-3 rounded px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
          >
            {connecting ? 'Connecting…' : 'Connect to Device'}
          </button>
        </Section>

        <Section title="MODBUS RTU (RS-485)">
          <Row label="COM port">
            <input type="text" placeholder="/dev/ttyUSB0 or COM3"
              value={settings.last_rtu_port ?? ''}
              onChange={(e) => handleUpdate({ last_rtu_port: e.target.value || null })}
              style={{ ...inputClass, width: 160 }} />
          </Row>
          <Row label="Baudrate">
            <select value={settings.last_rtu_baudrate}
              onChange={(e) => handleUpdate({ last_rtu_baudrate: +e.target.value })}
              style={{ ...inputClass, width: 'auto', padding: '2px 6px' }}>
              {[9600, 19200, 38400, 57600, 115200].map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Row>
          <Row label="Slave ID">
            <input type="number" min={1} max={247} value={settings.last_rtu_slave_id}
              onChange={(e) => handleUpdate({ last_rtu_slave_id: +e.target.value })}
              style={{ ...inputClass, width: 64, textAlign: 'center' }} />
          </Row>
        </Section>

        <Section title="ALARM THRESHOLDS">
          <p className="text-2xs mb-3" style={{ color: 'var(--text-3)' }}>
            Changes apply immediately and persist across sessions.
            LL = Low-Low (critical) · L = Low (warning) · H = High (warning) · HH = High-High (critical)
          </p>

          {/* Pressure */}
          <div className="mb-3">
            <div className="text-2xs font-bold tracking-widest mb-2" style={{ color: 'var(--text-2)' }}>PRESSURE (bar)</div>
            <div className="grid grid-cols-4 gap-2">
              {(['ll', 'l', 'h', 'hh'] as const).map((key) => (
                <div key={key}>
                  <div className="text-2xs mb-1 font-semibold" style={{ color: key === 'll' || key === 'hh' ? 'var(--crit)' : 'var(--warn)' }}>
                    {key.toUpperCase()}
                  </div>
                  <input
                    type="number" step="0.1" value={pDraft[key]}
                    onChange={(e) => setPDraft((d) => ({ ...d, [key]: parseFloat(e.target.value) || 0 }))}
                    onBlur={() => setPressure(pDraft)}
                    style={{ ...inputClass, width: '100%', textAlign: 'center' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div className="mb-3">
            <div className="text-2xs font-bold tracking-widest mb-2" style={{ color: 'var(--text-2)' }}>TEMPERATURE (°C)</div>
            <div className="grid grid-cols-4 gap-2">
              {(['ll', 'l', 'h', 'hh'] as const).map((key) => (
                <div key={key}>
                  <div className="text-2xs mb-1 font-semibold" style={{ color: key === 'll' || key === 'hh' ? 'var(--crit)' : 'var(--warn)' }}>
                    {key.toUpperCase()}
                  </div>
                  <input
                    type="number" step="0.5" value={tDraft[key]}
                    onChange={(e) => setTDraft((d) => ({ ...d, [key]: parseFloat(e.target.value) || 0 }))}
                    onBlur={() => setTemperature(tDraft)}
                    style={{ ...inputClass, width: '100%', textAlign: 'center' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Health Score */}
          <div>
            <div className="text-2xs font-bold tracking-widest mb-2" style={{ color: 'var(--text-2)' }}>SYSTEM HEALTH (score 0–100)</div>
            <div className="grid grid-cols-4 gap-2">
              {(['ll', 'l'] as const).map((key) => (
                <div key={key}>
                  <div className="text-2xs mb-1 font-semibold" style={{ color: key === 'll' ? 'var(--crit)' : 'var(--warn)' }}>
                    {key.toUpperCase()}
                  </div>
                  <input
                    type="number" step="1" min="0" max="100" value={hDraft[key]}
                    onChange={(e) => setHDraft((d) => ({ ...d, [key]: parseInt(e.target.value) || 0 }))}
                    onBlur={() => setHealth(hDraft)}
                    style={{ ...inputClass, width: '100%', textAlign: 'center' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="APPLICATION">
          <Row label="Version">
            <span className="font-mono text-xs">v{appVersion}</span>
          </Row>
          <Row label="Settings location">
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>Tauri app data dir</span>
          </Row>
        </Section>

      </div>
    </div>
  );
};
