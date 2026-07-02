import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MultiTrendChart }    from '../components/charts/MultiTrendChart';
import { TrendChart }         from '../components/charts/TrendChart';
import { useConnectionStore } from '../store/connectionStore';
import { useSensorStore }     from '../store/sensorStore';
import { useToastStore }      from '../store/toastStore';
import type { SensorReading } from '../types/sensor';

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildCsv(rows: SensorReading[]): string {
  const header = 'timestamp,machine_id,pressure,temperature,status';
  const lines  = rows.map(
    (r) =>
      `${r.timestamp},${r.machine_id ?? 'RAV-01'},${r.pressure},${r.temperature ?? ''},${r.status ?? ''}`,
  );
  return [header, ...lines].join('\n');
}

function computeStats(readings: SensorReading[]) {
  if (!readings.length) return null;
  let pMin = Infinity, pMax = -Infinity, pSum = 0;
  let tMin = Infinity, tMax = -Infinity, tSum = 0, tCount = 0;
  for (const r of readings) {
    pMin = Math.min(pMin, r.pressure);
    pMax = Math.max(pMax, r.pressure);
    pSum += r.pressure;
    if (r.temperature != null) {
      tMin = Math.min(tMin, r.temperature);
      tMax = Math.max(tMax, r.temperature);
      tSum += r.temperature;
      tCount++;
    }
  }
  const latest = readings[readings.length - 1];
  return {
    pressure:    { min: pMin, max: pMax, avg: pSum / readings.length, latest: latest?.pressure ?? 0 },
    temperature: { min: tCount ? tMin : 0, max: tCount ? tMax : 0, avg: tCount ? tSum / tCount : 0, latest: latest?.temperature ?? 0 },
  };
}

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: '15 min', minutes: 15   },
  { label: '1 hr',   minutes: 60   },
  { label: '6 hr',   minutes: 360  },
  { label: '24 hr',  minutes: 1440 },
] as const;

type PresetMinutes = (typeof PRESETS)[number]['minutes'];
type ViewMode = 'combined' | 'split';

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatProps {
  label: string;
  value: string;
  unit: string;
  color: string;
  sub?: string;
}

function StatCard({ label, value, unit, color, sub }: StatProps) {
  return (
    <div
      className="scada-panel"
      style={{ padding: '12px 16px', minWidth: 0, flex: 1 }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="eng-value" style={{ fontSize: 22, fontWeight: 700, color }}>{value}</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{unit}</span>
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const HistoricalTrendsPage: React.FC = () => {
  const apiBase       = useConnectionStore((s) => s.config?.apiBase ?? 'http://localhost:8000');
  const storeReadings = useSensorStore((s) => s.readings);
  const push          = useToastStore((s) => s.push);

  const [preset,     setPreset]     = useState<PresetMinutes>(60);
  const [loading,    setLoading]    = useState(false);
  const [dbReadings, setDbReadings] = useState<SensorReading[]>([]);
  const [dbCount,    setDbCount]    = useState<number | null>(null);
  const [totalStored, setTotalStored] = useState<number | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [viewMode,   setViewMode]   = useState<ViewMode>('combined');

  const allReadings = useMemo<SensorReading[]>(() => {
    const liveBridgeReadings = storeReadings.filter((r) => r.source === 'bridge');
    if (!dbReadings.length) return liveBridgeReadings;
    const cutoff    = dbReadings[dbReadings.length - 1]?.timestamp ?? '';
    const liveTail  = liveBridgeReadings.filter((r) => r.timestamp > cutoff);
    const merged    = [...dbReadings, ...liveTail];
    return merged.length > 50_000 ? merged.slice(-50_000) : merged;
  }, [dbReadings, storeReadings]);

  const isHistorical = dbReadings.length > 0;
  const stats = useMemo(() => computeStats(allReadings), [allReadings]);

  // ── Load from DB ────────────────────────────────────────────────────────────

  const loadHistory = useCallback(
    async (minutes: number) => {
      setLoading(true);
      setError(null);
      try {
        const to   = new Date().toISOString();
        const from = new Date(Date.now() - minutes * 60_000).toISOString();
        const params = new URLSearchParams({ from_ts: from, to_ts: to, limit: '10000' });
        const res = await fetch(`${apiBase}/api/sensors/history?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: {
          count: number;
          total_stored: number;
          readings: SensorReading[];
        } = await res.json();
        setDbReadings(data.readings.filter((r) => r.source === 'bridge').reverse());
        setDbCount(data.count);
        setTotalStored(data.total_stored);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    },
    [apiBase],
  );

  useEffect(() => {
    loadHistory(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Export CSV ──────────────────────────────────────────────────────────────

  const exportCsv = useCallback(() => {
    if (!allReadings.length) return;
    const csv = buildCsv(allReadings);
    try {
      navigator.clipboard.writeText(csv);
      push(`${allReadings.length.toLocaleString()} readings copied to clipboard as CSV`, 'ok');
    } catch {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ultron-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [allReadings, push]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
        }}
      >
        {/* Time range button group */}
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {PRESETS.map((p) => {
            const active = preset === p.minutes;
            return (
              <button
                key={p.label}
                onClick={() => { setPreset(p.minutes); loadHistory(p.minutes); }}
                style={{
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                  border: 'none',
                  borderRight: '1px solid var(--border)',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-3)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['combined', 'split'] as const).map((mode) => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={mode === 'combined' ? 'Combined overlay chart' : 'Split individual charts'}
                style={{
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  border: 'none',
                  borderRight: '1px solid var(--border)',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-3)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {mode === 'combined' ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="1" width="14" height="14" rx="2" />
                    <path d="M1 8h14" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="1" width="14" height="6" rx="2" />
                    <rect x="1" y="9" width="14" height="6" rx="2" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <button
          onClick={() => loadHistory(preset)}
          disabled={loading}
          className="btn-secondary"
          style={{ padding: '6px 14px', fontSize: 11, borderRadius: 6, opacity: loading ? 0.5 : 1 }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 8A6 6 0 1 1 8 2" strokeLinecap="round" />
            <path d="M14 2v6h-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {loading ? 'Loading…' : 'Refresh'}
        </button>

        {allReadings.length > 0 && (
          <button onClick={exportCsv} className="btn-secondary" style={{ padding: '6px 14px', fontSize: 11, borderRadius: 6 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2v8M5 7l3 3 3-3M3 12h10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
          </button>
        )}

        {/* Status — pushed right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {error && (
            <span style={{ fontSize: 10, color: 'var(--crit)', fontWeight: 600 }}>
              {error}
            </span>
          )}
          <span
            style={{
              fontSize: 10,
              fontFamily: '"JetBrains Mono", monospace',
              color: 'var(--text-3)',
            }}
          >
            {dbCount !== null
              ? `${dbCount.toLocaleString()} from DB`
              : loading
              ? 'Loading…'
              : 'No DB data'}
            {' · '}
            {allReadings.length.toLocaleString()} pts
            {totalStored !== null && ` · ${totalStored.toLocaleString()} stored`}
          </span>
        </div>
      </div>

      {/* ── Stats Row ───────────────────────────────────────────────────────── */}
      {stats && (
        <div
          className="flex-shrink-0 animate-fade-in"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, padding: '10px 12px', background: 'var(--surface)' }}
        >
          <StatCard
            label="Pressure (latest)"
            value={stats.pressure.latest.toFixed(2)}
            unit="bar"
            color="var(--info)"
            sub={`Min ${stats.pressure.min.toFixed(1)} · Avg ${stats.pressure.avg.toFixed(1)} · Max ${stats.pressure.max.toFixed(1)}`}
          />
          <StatCard
            label="Temperature (latest)"
            value={stats.temperature.latest.toFixed(1)}
            unit="°C"
            color="var(--warn)"
            sub={`Min ${stats.temperature.min.toFixed(0)} · Avg ${stats.temperature.avg.toFixed(0)} · Max ${stats.temperature.max.toFixed(0)}`}
          />
          <StatCard
            label="Data Points"
            value={allReadings.length.toLocaleString()}
            unit="pts"
            color="var(--text)"
            sub={totalStored !== null ? `${totalStored.toLocaleString()} total in database` : 'Live data only'}
          />
          <StatCard
            label="Time Range"
            value={PRESETS.find((p) => p.minutes === preset)?.label ?? '—'}
            unit=""
            color="var(--accent)"
            sub={isHistorical ? 'Historical + Live tail' : 'Live stream only'}
          />
        </div>
      )}

      {/* ── Charts Area ─────────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-auto"
        style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {viewMode === 'combined' ? (
          <div style={{ flex: 1, minHeight: 250 }}>
            <MultiTrendChart readings={allReadings} historical={isHistorical} />
          </div>
        ) : (
          <>
            <div style={{ flex: 1, minHeight: 200 }}>
              <TrendChart type="pressure" readings={allReadings} />
            </div>
            <div style={{ flex: 1, minHeight: 200 }}>
              <TrendChart type="temperature" readings={allReadings} />
            </div>
          </>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="app-footer">
        <span>ULTRON INDUSTRIAL CONTROL · HISTORICAL TRENDS</span>
        <span>
          {isHistorical ? 'DB + Live' : 'Live'} · {allReadings.length.toLocaleString()} pts · {
            PRESETS.find((p) => p.minutes === preset)?.label ?? '—'
          } window
        </span>
      </footer>
    </div>
  );
};
