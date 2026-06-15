import React from 'react';
import { useAppStore }             from '../store/appStore';
import { useHistoricalReadings }   from '../hooks/useHistoricalReadings';
import { PressureCard }            from '../components/cards/PressureCard';
import { TemperatureCard }         from '../components/cards/TemperatureCard';
import { HealthScoreCard }         from '../components/cards/HealthScoreCard';
import { MultiTrendChart }         from '../components/charts/MultiTrendChart';
import { TrendChart }              from '../components/charts/TrendChart';
import { AlarmPanel }              from '../components/panels/AlarmPanel';
import { ProcessOverview }         from '../components/panels/ProcessOverview';

interface Props {
  alarmsOnly?: boolean;
}

function SimBanner() {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-2xs font-semibold tracking-widest uppercase flex-shrink-0"
      style={{ background: 'var(--warn-dim)', borderBottom: '1px solid var(--warn)', color: 'var(--warn)' }}>
      <span className="status-dot" style={{ background: 'var(--warn)' }} />
      Simulation Mode — No hardware connected
    </div>
  );
}

export const DashboardPage: React.FC<Props> = ({ alarmsOnly }) => {
  const appPhase = useAppStore((s) => s.appPhase);
  const isSim    = appPhase === 'simulation';

  // Load last 30 min from DB on mount; merges with live readings automatically
  const trendReadings = useHistoricalReadings(30);

  if (alarmsOnly) {
    return (
      <div className="flex flex-col h-full">
        {isSim && <SimBanner />}
        <div className="flex-1 overflow-auto p-4"><AlarmPanel /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {isSim && <SimBanner />}

      <div className="flex flex-col flex-1 min-h-0 p-3 gap-3">

        {/* Row 1 — metric cards */}
        <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PressureCard />
          <TemperatureCard />
          <HealthScoreCard />
        </div>

        {/* Row 2 — digital twin (2/3) + trend chart (1/3) */}
        <div className="flex gap-3" style={{ flex: 1, minHeight: 0 }}>
          <div style={{ flex: 2, minHeight: 0 }}>
            <ProcessOverview />
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <MultiTrendChart readings={trendReadings} historical={trendReadings.length > 600} />
          </div>
        </div>

      </div>

      <footer className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 border-t text-2xs font-mono"
        style={{ borderColor: 'var(--border)', color: 'var(--text-3)', background: 'var(--panel)' }}>
        <span>ULTRON INDUSTRIAL CONTROL · OSWAR SOFTWARE · PHASE 1 DEMO</span>
        <span>RPi4 · WebSocket · Modbus TCP/RTU</span>
      </footer>
    </div>
  );
};
