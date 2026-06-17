import React, { useState } from 'react';
import { useSensorStore }    from '../../store/sensorStore';
import { useThresholdStore } from '../../store/thresholdStore';
import { useAlarmStore }     from '../../store/alarmStore';
import type { AlarmEvent }   from '../../store/alarmStore';
import { Panel }             from '../ui/Panel';
import { cn }                from '../../utils/cn';

interface AlarmDef {
  id: string; label: string; tag: string;
  type: 'warning' | 'critical'; active: boolean; value: string; message: string;
}

function formatEventTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return '--:--:--'; }
}

function formatDuration(firedAt: string, clearedAt: string | null): string {
  if (!clearedAt) return 'ACTIVE';
  const s = Math.floor((new Date(clearedAt).getTime() - new Date(firedAt).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '2px 10px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, borderRadius: 2, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-dim)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer' }}>
      {label}
    </button>
  );
}

function HistoryTable({ history, onClear }: { history: AlarmEvent[]; onClear: () => void }) {
  if (!history.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No alarm events recorded yet.</span>
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Events appear here when alarm thresholds are crossed.</span>
      </div>
    );
  }
  const col = (w?: number): React.CSSProperties => ({ padding: '0.35rem 0.6rem', fontSize: 10, whiteSpace: 'nowrap' as const, ...(w ? { width: w } : {}) });
  const cols = '80px 64px 1fr 90px 72px';
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{history.length} event{history.length !== 1 ? 's' : ''}</span>
        <button onClick={onClear} style={{ fontSize: 9, color: 'var(--text-3)', background: 'none', border: '1px solid var(--border)', borderRadius: 2, padding: '1px 8px', cursor: 'pointer' }}>Clear history</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '0.3rem 0', borderBottom: '1px solid var(--border)', color: 'var(--text-3)', fontWeight: 700, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <span style={col()}>Time</span><span style={col()}>Tag</span><span style={col()}>Alarm</span><span style={col()}>Value</span><span style={col()}>Duration</span>
      </div>
      {history.map((ev) => {
        const color = ev.severity === 'critical' ? 'var(--crit)' : 'var(--warn)';
        const isOpen = !ev.clearedAt;
        return (
          <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid var(--border)', background: isOpen ? (ev.severity === 'critical' ? 'var(--crit-dim)' : 'var(--warn-dim)') : 'transparent' }}>
            <span style={{ ...col(), fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-3)', fontSize: 9 }}>{formatEventTime(ev.firedAt)}</span>
            <span style={{ ...col(), fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-3)', fontSize: 9 }}>{ev.tag}</span>
            <span style={{ ...col(), color: isOpen ? color : 'var(--text-2)' }}>{ev.label}</span>
            <span style={{ ...col(), fontFamily: '"JetBrains Mono", monospace', color: isOpen ? color : 'var(--text-3)', fontWeight: 600 }}>{ev.value}</span>
            <span style={{ ...col(), color: isOpen ? color : 'var(--text-3)', fontWeight: isOpen ? 700 : 400 }}>{formatDuration(ev.firedAt, ev.clearedAt)}</span>
          </div>
        );
      })}
    </div>
  );
}

export const AlarmPanel: React.FC = () => {
  const alarms       = useSensorStore((s) => s.alarms);
  const latest       = useSensorStore((s) => s.latest);
  const pt           = useThresholdStore((s) => s.pressure);
  const tt           = useThresholdStore((s) => s.temperature);
  const ackedIds     = useAlarmStore((s) => s.ackedIds);
  const history      = useAlarmStore((s) => s.history);
  const ack          = useAlarmStore((s) => s.ack);
  const clearHistory = useAlarmStore((s) => s.clearHistory);

  const [tab, setTab] = useState<'active' | 'history'>('active');

  const p = latest?.pressure    ?? 0;
  const t = latest?.temperature ?? 0;

  const defs: AlarmDef[] = [
    { id: 'llPressure',    label: 'Pressure Low-Low',     tag: 'PRS-LL', type: 'critical', active: alarms.llPressure,    value: `${p.toFixed(2)} bar`, message: `Below ${pt.ll} bar — CRITICAL LOW` },
    { id: 'lPressure',     label: 'Pressure Low',          tag: 'PRS-L',  type: 'warning',  active: alarms.lPressure,     value: `${p.toFixed(2)} bar`, message: `Below ${pt.l} bar — check supply` },
    { id: 'hPressure',     label: 'Pressure High',         tag: 'PRS-H',  type: 'warning',  active: alarms.hPressure,     value: `${p.toFixed(2)} bar`, message: `Exceeds ${pt.h} bar — reduce load` },
    { id: 'hhPressure',    label: 'Pressure High-High',    tag: 'PRS-HH', type: 'critical', active: alarms.hhPressure,    value: `${p.toFixed(2)} bar`, message: `Exceeds ${pt.hh} bar — IMMEDIATE ACTION` },
    { id: 'llTemperature', label: 'Temperature Low-Low',   tag: 'TMP-LL', type: 'critical', active: alarms.llTemperature, value: `${t.toFixed(1)} °C`,  message: `Below ${tt.ll}°C — CRITICAL LOW` },
    { id: 'lTemperature',  label: 'Temperature Low',       tag: 'TMP-L',  type: 'warning',  active: alarms.lTemperature,  value: `${t.toFixed(1)} °C`,  message: `Below ${tt.l}°C — check heating` },
    { id: 'hTemperature',  label: 'Temperature High',      tag: 'TMP-H',  type: 'warning',  active: alarms.hTemperature,  value: `${t.toFixed(1)} °C`,  message: `Exceeds ${tt.h}°C — check cooling` },
    { id: 'hhTemperature', label: 'Temperature High-High', tag: 'TMP-HH', type: 'critical', active: alarms.hhTemperature, value: `${t.toFixed(1)} °C`,  message: `Exceeds ${tt.hh}°C — SHUTDOWN RISK` },
  ];

  const activeCount = defs.filter((d) => d.active).length;
  const hasCrit     = defs.some((d) => d.active && d.type === 'critical');
  const panelStatus = hasCrit ? 'critical' as const : activeCount > 0 ? 'warning' as const : 'none' as const;

  const badge = activeCount > 0
    ? <span className={cn('text-2xs font-bold tracking-widest px-1.5 py-0.5 rounded', hasCrit && 'alarm-flash')} style={{ background: hasCrit ? 'var(--crit-dim)' : 'var(--warn-dim)', color: hasCrit ? 'var(--crit)' : 'var(--warn)' }}>{activeCount} ACTIVE</span>
    : <span className="text-2xs font-bold tracking-widest px-1.5 py-0.5 rounded" style={{ background: 'var(--ok-dim)', color: 'var(--ok)' }}>ALL CLEAR</span>;

  const tabs = (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {badge}
      <div style={{ width: 8 }} />
      <TabBtn label={`Active${activeCount > 0 ? ` (${activeCount})` : ''}`} active={tab === 'active'} onClick={() => setTab('active')} />
      <TabBtn label={`History${history.length > 0 ? ` (${history.length})` : ''}`} active={tab === 'history'} onClick={() => setTab('history')} />
    </div>
  );

  return (
    <Panel title="ALARM MONITOR" status={panelStatus} actions={tabs} noPadding>
      {tab === 'active' && (
        <>
          <div className="grid text-2xs font-bold tracking-widest uppercase border-b" style={{ gridTemplateColumns: '1fr 80px 120px 1fr 64px', borderColor: 'var(--border)', color: 'var(--text-3)', padding: '0.375rem 0.75rem' }}>
            <span>Alarm</span><span>Tag</span><span>Value</span><span>Message</span><span>State</span>
          </div>
          <div>
            {defs.map((def) => {
              const color = def.type === 'critical' ? 'var(--crit)' : 'var(--warn)';
              const isAcked = ackedIds.includes(def.id);
              return (
                <div key={def.id} className="grid items-center border-b last:border-0" style={{ gridTemplateColumns: '1fr 80px 120px 1fr 64px', padding: '0.5rem 0.75rem', borderColor: 'var(--border)', background: def.active && !isAcked ? (def.type === 'critical' ? 'var(--crit-dim)' : 'var(--warn-dim)') : 'transparent', opacity: def.active ? 1 : 0.45 }}>
                  <div className="flex items-center gap-2">
                    <span className={cn('status-dot flex-shrink-0', def.active && !isAcked && 'animate-status-pulse')} style={{ background: def.active ? color : 'var(--border-hi)' }} />
                    <span className="text-xs font-medium truncate" style={{ color: def.active ? 'var(--text)' : 'var(--text-3)' }}>{def.label}</span>
                  </div>
                  <span className="text-2xs font-mono" style={{ color: 'var(--text-3)' }}>{def.tag}</span>
                  <span className="text-xs font-mono font-semibold" style={{ color: def.active ? color : 'var(--text-3)' }}>{def.value}</span>
                  <span className="text-2xs truncate pr-2" style={{ color: def.active ? 'var(--text-2)' : 'var(--text-3)' }}>{def.active ? def.message : 'Normal — no action required'}</span>
                  <div>
                    {def.active && !isAcked
                      ? <button onClick={() => ack(def.id)} className="text-2xs font-semibold px-1.5 py-0.5 rounded border" style={{ color, borderColor: color, background: 'transparent', cursor: 'pointer' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = def.type === 'critical' ? 'var(--crit-dim)' : 'var(--warn-dim)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>ACK</button>
                      : <span className="text-2xs font-semibold" style={{ color: isAcked ? 'var(--text-3)' : 'var(--ok)' }}>{def.active ? 'ACKED' : 'NORMAL'}</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-4 gap-2 m-3 p-2 rounded text-2xs font-mono" style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--text-3)' }}>P-LL <span style={{ color: 'var(--crit)' }}>{pt.ll} bar</span></div>
            <div style={{ color: 'var(--text-3)' }}>P-L  <span style={{ color: 'var(--warn)' }}>{pt.l} bar</span></div>
            <div style={{ color: 'var(--text-3)' }}>P-H  <span style={{ color: 'var(--warn)' }}>{pt.h} bar</span></div>
            <div style={{ color: 'var(--text-3)' }}>P-HH <span style={{ color: 'var(--crit)' }}>{pt.hh} bar</span></div>
            <div style={{ color: 'var(--text-3)' }}>T-LL <span style={{ color: 'var(--crit)' }}>{tt.ll}°C</span></div>
            <div style={{ color: 'var(--text-3)' }}>T-L  <span style={{ color: 'var(--warn)' }}>{tt.l}°C</span></div>
            <div style={{ color: 'var(--text-3)' }}>T-H  <span style={{ color: 'var(--warn)' }}>{tt.h}°C</span></div>
            <div style={{ color: 'var(--text-3)' }}>T-HH <span style={{ color: 'var(--crit)' }}>{tt.hh}°C</span></div>
          </div>
        </>
      )}
      {tab === 'history' && <HistoryTable history={history} onClear={clearHistory} />}
    </Panel>
  );
};
