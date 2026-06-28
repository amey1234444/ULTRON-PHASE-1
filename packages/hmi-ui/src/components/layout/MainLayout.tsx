import React, { useState, useEffect } from 'react';

import { useConnectionManager }    from '../../hooks/useConnectionManager';
import { ToastContainer }          from '../ui/ToastContainer';
import { DashboardPage }           from '../../pages/DashboardPage';
import { HistoricalTrendsPage }    from '../../pages/HistoricalTrendsPage';
import { SettingsPage }            from '../../pages/SettingsPage';
import { DiagnosticsPage }         from '../../pages/DiagnosticsPage';

import { useAssetHierarchyStore }  from '../../store/assetHierarchyStore';
import { useConnectionStore }      from '../../store/connectionStore';
import { useSensorStore }          from '../../store/sensorStore';
import { cn }                      from '../../utils/cn';

export type TabView = 'live' | 'trends' | 'configuration' | 'alarms' | 'diagnostics';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// Gigaton-style dropdown selector
function Selector({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-2 py-1 outline-none focus:border-green-400 cursor-pointer min-w-[120px]"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// Connection status indicator
function StatusIndicator() {
  const status = useSensorStore((s) => s.connectionStatus);
  const colors: Record<string, string> = {
    connected: '#22c55e',
    connecting: '#eab308',
    disconnected: '#6b7280',
    error: '#ef4444',
  };
  const labels: Record<string, string> = {
    connected: 'LIVE',
    connecting: 'CONNECTING',
    disconnected: 'OFFLINE',
    error: 'ERROR',
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: colors[status] ?? '#6b7280' }} />
      <span className="w-2 h-2 rounded-full" style={{ background: colors[status] ?? '#6b7280', opacity: 0.6 }} />
      <span className="w-2 h-2 rounded-full" style={{ background: colors[status] ?? '#6b7280', opacity: 0.3 }} />
      <span className="text-[10px] font-bold tracking-wider ml-1" style={{ color: colors[status] ?? '#6b7280' }}>
        {labels[status] ?? 'UNKNOWN'}
      </span>
    </div>
  );
}

export const MainLayout: React.FC = () => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabView>('live');

  // Asset hierarchy selectors
  const tree = useAssetHierarchyStore((s) => s.tree);
  const selectedCompanyId = useAssetHierarchyStore((s) => s.selectedCompanyId);
  const selectedPlantId = useAssetHierarchyStore((s) => s.selectedPlantId);
  const selectedAreaId = useAssetHierarchyStore((s) => s.selectedAreaId);
  const selectedMachineId = useAssetHierarchyStore((s) => s.selectedMachineId);
  const selectedEquipmentId = useAssetHierarchyStore((s) => s.selectedEquipmentId);
  const selectedEquipmentTypeId = useAssetHierarchyStore((s) => s.selectedEquipmentTypeId);
  const selectCompany = useAssetHierarchyStore((s) => s.selectCompany);
  const selectPlant = useAssetHierarchyStore((s) => s.selectPlant);
  const selectArea = useAssetHierarchyStore((s) => s.selectArea);
  const selectMachine = useAssetHierarchyStore((s) => s.selectMachine);
  const selectEquipment = useAssetHierarchyStore((s) => s.selectEquipment);
  const selectEquipmentType = useAssetHierarchyStore((s) => s.selectEquipmentType);
  const fetchTree = useAssetHierarchyStore((s) => s.fetchTree);

  const config = useConnectionStore((s) => s.config);
  const apiBase = config?.apiBase ?? import.meta.env.VITE_API_BASE ?? '';

  useConnectionManager();

  useEffect(() => {
    if (apiBase) fetchTree(apiBase);
  }, [apiBase, fetchTree]);

  // Auto-select first items if not selected
  useEffect(() => {
    if (!selectedCompanyId && tree.length > 0) selectCompany(tree[0].id);
  }, [tree, selectedCompanyId, selectCompany]);

  const company = tree.find((c) => c.id === selectedCompanyId);
  const plants = company?.children ?? [];

  useEffect(() => {
    if (!selectedPlantId && plants.length > 0) selectPlant(plants[0].id);
  }, [plants, selectedPlantId, selectPlant]);

  const plant = plants.find((p) => p.id === selectedPlantId);
  const areas = plant?.children ?? [];

  useEffect(() => {
    if (!selectedAreaId && areas.length > 0) selectArea(areas[0].id);
  }, [areas, selectedAreaId, selectArea]);

  const area = areas.find((a) => a.id === selectedAreaId);
  const machines = area?.children ?? [];

  useEffect(() => {
    if (!selectedMachineId && machines.length > 0) selectMachine(machines[0].id);
  }, [machines, selectedMachineId, selectMachine]);

  const machine = machines.find((m) => m.id === selectedMachineId);
  const equipments = machine?.children ?? [];

  useEffect(() => {
    if (!selectedEquipmentId && equipments.length > 0) selectEquipment(equipments[0].id);
  }, [equipments, selectedEquipmentId, selectEquipment]);

  const equipment = equipments.find((e) => e.id === selectedEquipmentId);
  const equipmentTypes = equipment?.children ?? [];

  useEffect(() => {
    if (!selectedEquipmentTypeId && equipmentTypes.length > 0) selectEquipmentType(equipmentTypes[0].id);
  }, [equipmentTypes, selectedEquipmentTypeId, selectEquipmentType]);

  // Tab configuration
  const tabs: { id: TabView; label: string }[] = [
    { id: 'live', label: 'Live Control' },
    { id: 'trends', label: 'Trends' },
    { id: 'configuration', label: 'Configuration' },
    { id: 'alarms', label: 'Alarms' },
    { id: 'diagnostics', label: 'Diagnostics' },
  ];

  function renderContent() {
    switch (activeTab) {
      case 'live':          return <DashboardPage />;
      case 'trends':        return <HistoricalTrendsPage />;
      case 'configuration': return <SettingsPage onBack={() => setActiveTab('live')} />;
      case 'alarms':        return <DashboardPage alarmsOnly />;
      case 'diagnostics':   return <DiagnosticsPage onBack={() => setActiveTab('live')} />;
      default:              return null;
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0f1419]">
      {/* Top Header Bar - Gigaton style */}
      <header className="flex-shrink-0 flex items-center h-12 px-4 gap-4 bg-[#1a1f2e] border-b border-gray-700/50">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-4">
          <img src="/oswar-logo.png" alt="Oswar" className="h-6 object-contain" />
        </div>

        {/* Plant Selector */}
        {!isMobile && plants.length > 0 && (
          <Selector
            label="PLANT"
            value={selectedPlantId ?? ''}
            options={plants.map((p) => ({ id: p.id, label: p.label }))}
            onChange={selectPlant}
          />
        )}

        {/* Equipment Type Selector */}
        {!isMobile && equipmentTypes.length > 0 && (
          <Selector
            label="EQUIPMENT"
            value={selectedEquipmentTypeId ?? ''}
            options={equipmentTypes.map((et) => ({ id: et.id, label: et.label }))}
            onChange={selectEquipmentType}
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status */}
        <StatusIndicator />
      </header>

      {/* Tab Navigation Bar */}
      <nav className="flex-shrink-0 flex items-center h-10 px-4 gap-1 bg-[#141922] border-b border-gray-700/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-xs font-medium rounded-t transition-colors relative',
              activeTab === tab.id
                ? 'text-white bg-[#1e2736]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a2030]'
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-green-400 rounded-full" />
            )}
          </button>
        ))}

        {/* Mobile selectors */}
        {isMobile && (
          <div className="ml-auto flex gap-2">
            {equipmentTypes.length > 0 && (
              <select
                value={selectedEquipmentTypeId ?? ''}
                onChange={(e) => selectEquipmentType(e.target.value)}
                className="bg-gray-800 border border-gray-600 text-white text-[10px] rounded px-1 py-0.5"
              >
                {equipmentTypes.map((et) => (
                  <option key={et.id} value={et.id}>{et.label}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>

      <ToastContainer />
    </div>
  );
};
