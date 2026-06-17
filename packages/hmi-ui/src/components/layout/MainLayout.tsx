import React, { useState, useEffect } from 'react';
import { useAppStore }             from '../../store/appStore';
import { useConnectionManager }    from '../../hooks/useConnectionManager';
import { Sidebar, type SidebarView } from './Sidebar';
import { TopBar }                  from './TopBar';
import { ToastContainer }          from '../ui/ToastContainer';
import { DashboardPage }           from '../../pages/DashboardPage';
import { HistoricalTrendsPage }    from '../../pages/HistoricalTrendsPage';
import { SettingsPage }            from '../../pages/SettingsPage';
import { DiagnosticsPage }         from '../../pages/DiagnosticsPage';
import { MonitoringPage }          from '../../pages/MonitoringPage';
import { PlaceholderPage }         from '../../pages/PlaceholderPage';
import { AssetSelectionPage }      from '../../pages/AssetSelectionPage';
import { useAssetHierarchyStore }  from '../../store/assetHierarchyStore';

function phaseToView(phase: string): SidebarView {
  if (phase === 'settings')    return 'settings';
  if (phase === 'diagnostics') return 'diagnostics';
  return 'overview';
}

export const MainLayout: React.FC = () => {
  const appPhase = useAppStore((s) => s.appPhase);
  const selectedEquipmentTypeId = useAssetHierarchyStore((s) => s.selectedEquipmentTypeId);
  const [collapsed, setCollapsed]   = useState(false);
  const [activeView, setActiveView] = useState<SidebarView>(() => phaseToView(appPhase));

  useEffect(() => {
    setActiveView(phaseToView(appPhase));
  }, [appPhase]);

  useConnectionManager();

  function renderContent() {
    const requiresRotaryAirlock =
      activeView === 'overview' ||
      activeView === 'trends' ||
      activeView === 'alarms' ||
      activeView === 'monitoring';

    if (requiresRotaryAirlock && selectedEquipmentTypeId !== 'rotary-airlock-valve') {
      return <AssetSelectionPage />;
    }

    switch (activeView) {
      case 'overview':    return <DashboardPage />;
      case 'trends':      return <HistoricalTrendsPage />;
      case 'alarms':      return <DashboardPage alarmsOnly />;
      case 'monitoring':  return <MonitoringPage />;
      case 'diagnostics': return <DiagnosticsPage onBack={() => setActiveView('overview')} />;
      case 'settings':    return <SettingsPage onBack={() => setActiveView('overview')} />;
      case 'devices':
      case 'maintenance':
      case 'reports':     return <PlaceholderPage view={activeView} />;
      default:            return null;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
      <Sidebar
        collapsed={collapsed}
        active={activeView}
        onNavigate={setActiveView}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar onAlarmsClick={() => setActiveView('alarms')} />
        <main className="flex-1 overflow-auto">{renderContent()}</main>
      </div>
      <ToastContainer />
    </div>
  );
};
