import React from 'react';
import { StatusPanel }       from '../components/panels/StatusPanel';
import { SystemMetricsCard } from '../components/cards/SystemMetricsCard';

export const MonitoringPage: React.FC = () => (
  <div className="flex flex-col h-full">
    <div className="flex-shrink-0 px-4 pt-4 pb-2">
      <h2 className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-2)' }}>
        System Monitoring
      </h2>
      <p className="text-2xs mt-0.5" style={{ color: 'var(--text-3)' }}>
        Connection status and device health metrics
      </p>
    </div>

    <div className="flex-1 overflow-auto px-4 pb-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <StatusPanel />
        <SystemMetricsCard />
      </div>
    </div>
  </div>
);
