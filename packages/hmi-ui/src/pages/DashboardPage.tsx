import React from 'react';
import { useHistoricalReadings }   from '../hooks/useHistoricalReadings';
import { PressureCard }            from '../components/cards/PressureCard';
import { TemperatureCard }         from '../components/cards/TemperatureCard';
import { HealthScoreCard }         from '../components/cards/HealthScoreCard';
import { MultiTrendChart }         from '../components/charts/MultiTrendChart';
import { AlarmPanel }              from '../components/panels/AlarmPanel';
import { ProcessOverview }         from '../components/panels/ProcessOverview';
import { useAssetHierarchyStore }  from '../store/assetHierarchyStore';
import { useSensorStore }          from '../store/sensorStore';

interface Props {
  alarmsOnly?: boolean;
}

function BridgeStatusBanner() {
  const selectedEquipmentTypeId = useAssetHierarchyStore((s) => s.selectedEquipmentTypeId);
  const tree = useAssetHierarchyStore((s) => s.tree);
  const connectionStatus = useSensorStore((s) => s.connectionStatus);

  // Find selected equipment type's bridge_url
  let bridgeUrl = '';
  let equipLabel = '';
  function findNode(nodes: typeof tree): void {
    for (const n of nodes) {
      if (n.id === selectedEquipmentTypeId) {
        bridgeUrl = n.bridge_url ?? '';
        equipLabel = n.label;
        return;
      }
      if (n.children) findNode(n.children);
    }
  }
  findNode(tree);

  const hasBridge = bridgeUrl.length > 0;
  const isConnected = connectionStatus === 'connected';

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#1a1f2e] border-b border-gray-700/30">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${hasBridge && isConnected ? 'bg-green-400 animate-pulse' : hasBridge ? 'bg-yellow-400' : 'bg-gray-500'}`} />
        <span className="text-xs text-gray-300">
          {equipLabel && <span className="font-semibold text-white mr-2">{equipLabel}</span>}
          {hasBridge ? (
            <span className="text-green-400">Bridge: {bridgeUrl}</span>
          ) : (
            <span className="text-gray-500">No bridge configured — Simulation Mode</span>
          )}
        </span>
      </div>
    </div>
  );
}

export const DashboardPage: React.FC<Props> = ({ alarmsOnly }) => {
  const trendReadings = useHistoricalReadings(30);

  if (alarmsOnly) {
    return (
      <div className="flex flex-col h-full bg-[#0f1419]">
        <BridgeStatusBanner />
        <div className="flex-1 overflow-auto p-4"><AlarmPanel /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0f1419]">
      <BridgeStatusBanner />

      <div className="flex flex-col flex-1 min-h-0 p-3 gap-3">

        {/* Row 1 — metric cards */}
        <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PressureCard />
          <TemperatureCard />
          <HealthScoreCard />
        </div>

        {/* Row 2 — process overview + trend chart */}
        <div className="flex flex-col lg:flex-row gap-3" style={{ flex: 1, minHeight: 0 }}>
          <div className="lg:flex-[2] min-h-[200px] sm:min-h-[280px]" style={{ minHeight: 0 }}>
            <ProcessOverview />
          </div>
          <div className="lg:flex-[1] min-h-[200px] sm:min-h-[240px]" style={{ minHeight: 0 }}>
            <MultiTrendChart readings={trendReadings} historical={trendReadings.length > 600} />
          </div>
        </div>

      </div>
    </div>
  );
};
