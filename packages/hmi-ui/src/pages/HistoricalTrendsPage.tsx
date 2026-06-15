import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MultiTrendChart }    from '../components/charts/MultiTrendChart';
import { TrendChart }         from '../components/charts/TrendChart';
import { useConnectionStore } from '../store/connectionStore';
import { useSensorStore }     from '../store/sensorStore';
import { useAppStore }        from '../store/appStore';
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

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: '15 min', minutes: 15   },
  { label: '1 hr',   minutes: 60   },
  { label: '6 hr',   minutes: 360  },
  { label: '24 hr',  minutes: 1440 },
] as const;

type PresetMinutes = (typeof PRESETS)[number]['minutes'];

// ── SimBanner ─────────────────────────────────────────────────────────────────

function SimBanner() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '6px 16px',
        background: 'var(--warn-dim)',
        borderBottom: '1px solid var(--warn)',
        color: 'var(--warn)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        flexShrink: 0,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)' }} />
      Simulation Mode — No hardware connected
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const HistoricalTrendsPage: React.FC = () => {
  const apiBase       = useConnectionStore((s) => s.config?.apiBase ?? 'http://localhost:8000');
  const storeReadings = useSensorStore((s) => s.readings);
  const appPhase      = useAppStore((s) => s.appPhase);
  const push          = useToastStore((s) => s.push);
  const isSim         = appPhase === 'simulation';

  const [preset,     setPreset]     = useState<PresetMinutes>(60);
  const [loading,    setLoading]    = useState(false);
  const [dbReadings, setDbReadings] = useState<SensorReading[]>([]);
  const [dbCount,    setDbCount]    = useState<number | null>(null);
  const [totalStored, setTotalStored] = useState<number | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  // Merge DB readings with live store readings.
  // DB is newest-first reversed → chronological. Live readings are also chronological.
  // We append live readings that fall after the last DB timestamp to fill the flush gap.
  const allReadings = useMemo<SensorReading[]>(() => {
    if (!dbReadings.length) return storeReadings;
    const cutoff    = dbReadings[dbReadings.length - 1]?.timestamp ?? '';
    const liveTail  = storeReadings.filter((r) => r.timestamp > cutoff);
    const merged    = [...dbReadings, ...liveTail];
    return merged.length > 50_000 ? merged.slice(-50_000) : merged;
  }, [dbReadings, storeReadings]);

  const isHistorical = dbReadings.length > 0;

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
        // API returns newest-first — reverse for chronological chart order
        setDbReadings([...data.readings].reverse());
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

  // Auto-load last hour on mount
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

  // ── Styles ──────────────────────────────────────────────────────────────────

  const presetBtn = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    borderRadius: 2,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-3)',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  });

  const actionBtn = (disabled = false): React.CSSProperties => ({
    padding: '4px 12px',
    fontSize: 10,
    fontWeight: 600,
    borderRadius: 2,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: disabled ? 'var(--text-3)' : 'var(--text-2)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 120ms ease',
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {isSim && <SimBanner />}

      {/* ── Controls bar ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        {/* Preset time-range buttons */}
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setPreset(p.minutes);
              loadHistory(p.minutes);
            }}
            style={presetBtn(preset === p.minutes)}
          >
            {p.label}
          </button>
        ))}

        <div style={{ width: 1, height: 14, background: 'var(--border-hi)', flexShrink: 0 }} />

        {/* Refresh */}
        <button
          onClick={() => loadHistory(preset)}
          disabled={loading}
          style={actionBtn(loading)}
          title="Re-fetch from database"
        >
          {loading ? 'Loading…' : '↺ Refresh'}
        </button>

        {/* Export */}
        {allReadings.length > 0 && (
          <button onClick={exportCsv} style={actionBtn()}>
            Export CSV
          </button>
        )}

        {/* Status — pushed to the right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {error && (
            <span style={{ fontSize: 10, color: 'var(--crit)' }}>
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
            {allReadings.length.toLocaleString()} pts displayed
            {totalStored !== null && (
              <>
                {' · '}
                {totalStored.toLocaleString()} total stored
              </>
            )}
          </span>
        </div>
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ height: 320 }}>
          <MultiTrendChart readings={allReadings} historical={isHistorical} />
        </div>
        <TrendChart type="pressure"    readings={allReadings} />
        <TrendChart type="temperature" readings={allReadings} />
      </div>
    </div>
  );
};
