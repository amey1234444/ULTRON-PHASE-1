import React, { useEffect, useState } from 'react';
import { Panel } from '../ui/Panel';

interface MetricRow {
  label:   string;
  value:   number;
  unit:    string;
  warn:    number;
  crit:    number;
}

function useSimMetrics(): MetricRow[] {
  const [metrics, setMetrics] = useState<MetricRow[]>([
    { label: 'CPU',  value: 18, unit: '%', warn: 80, crit: 95 },
    { label: 'RAM',  value: 42, unit: '%', warn: 85, crit: 95 },
    { label: 'DISK', value: 55, unit: '%', warn: 85, crit: 95 },
    { label: 'TEMP', value: 52, unit: '°C', warn: 70, crit: 80 },
  ]);

  useEffect(() => {
    const t = setInterval(() => {
      setMetrics((prev) => prev.map((m) => ({
        ...m,
        value: Math.min(
          m.unit === '°C' ? 85 : 98,
          Math.max(
            m.unit === '°C' ? 35 : 2,
            m.value + (Math.random() - 0.5) * 4,
          ),
        ),
      })));
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return metrics;
}

function MetricBar({ m }: { m: MetricRow }) {
  const pct  = Math.min(100, Math.max(0, (m.value / (m.unit === '°C' ? 100 : 100)) * 100));
  const color = m.value >= m.crit ? 'var(--crit)' : m.value >= m.warn ? 'var(--warn)' : 'var(--ok)';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs font-semibold tracking-wider" style={{ color: 'var(--text-2)' }}>{m.label}</span>
        <span className="text-2xs font-mono eng-value" style={{ color }}>
          {m.value.toFixed(m.unit === '°C' ? 1 : 0)}{m.unit}
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export const SystemMetricsCard: React.FC = () => {
  const metrics = useSimMetrics();
  return (
    <Panel title="SYSTEM MONITOR">
      <div className="space-y-3">
        {metrics.map((m) => <MetricBar key={m.label} m={m} />)}
      </div>
    </Panel>
  );
};
