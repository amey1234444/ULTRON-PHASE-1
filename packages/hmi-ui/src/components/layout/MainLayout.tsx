import React, { useState, useEffect, useCallback } from 'react';
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
import { useDeviceBindingStore }   from '../../store/deviceBindingStore';
import { useSensorStore }          from '../../store/sensorStore';
import { useConnectionStore, SIMULATION_CONFIG } from '../../store/connectionStore';

function phaseToView(phase: string): SidebarView {
  if (phase === 'settings')    return 'settings';
  if (phase === 'diagnostics') return 'diagnostics';
  return 'overview';
}

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

export const MainLayout: React.FC = () => {
  const appPhase = useAppStore((s) => s.appPhase);
  const selectedEquipmentTypeId = useAssetHierarchyStore((s) => s.selectedEquipmentTypeId);
  const selectedMachineId = useAssetHierarchyStore((s) => s.selectedMachineId);
  const apiBase = useConnectionStore((s) => s.config?.apiBase) ?? SIMULATION_CONFIG.apiBase;
  const bindings = useDeviceBindingStore((s) => s.bindings);
  const fetchBindings = useDeviceBindingStore((s) => s.fetchBindings);
  const setActiveDevice = useSensorStore((s) => s.setActiveDevice);
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeView, setActiveView] = useState<SidebarView>(() => phaseToView(appPhase));

  useEffect(() => {
    setActiveView(phaseToView(appPhase));
  }, [appPhase]);

  useConnectionManager();

  // Keep device bindings fresh so routing knows each machine's machine_id.
  useEffect(() => {
    fetchBindings(apiBase);
    const id = setInterval(() => fetchBindings(apiBase), 4000);
    return () => clearInterval(id);
  }, [apiBase, fetchBindings]);

  // Route the live view to the selected machine's bound device (machine_id).
  // When the machine has no binding, fall back to the global stream.
  useEffect(() => {
    const boundMachineId = selectedMachineId ? bindings[selectedMachineId]?.machine_id ?? null : null;
    setActiveDevice(boundMachineId);
  }, [selectedMachineId, bindings, setActiveDevice]);

  const handleNavigate = useCallback((view: SidebarView) => {
    setActiveView(view);
    if (isMobile) setMobileOpen(false);
  }, [isMobile]);

  const toggleMobile = useCallback(() => setMobileOpen((o) => !o), []);

  function renderContent() {
    const requiresRotaryAirlock =
      activeView === 'overview' ||
      activeView === 'trends' ||
      activeView === 'alarms' ||
      activeView === 'monitoring';

    if (requiresRotaryAirlock && !selectedEquipmentTypeId?.startsWith('rotary-airlock-valve')) {
      return <AssetSelectionPage />;
    }

    switch (activeView) {
      case 'overview':    return <DashboardPage />;
      case 'trends':      return <HistoricalTrendsPage />;
      case 'alarms':      return <DashboardPage alarmsOnly />;
      case 'monitoring':  return <MonitoringPage />;
      case 'diagnostics': return <DiagnosticsPage onBack={() => handleNavigate('overview')} />;
      case 'settings':    return <SettingsPage onBack={() => handleNavigate('overview')} />;
      case 'devices':
      case 'maintenance':
      case 'reports':     return <PlaceholderPage view={activeView} />;
      default:            return null;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sidebar
          collapsed={collapsed}
          active={activeView}
          onNavigate={handleNavigate}
          onToggle={() => setCollapsed((c) => !c)}
        />
      )}

      {/* Mobile sidebar overlay */}
      {isMobile && (
        <>
          <div
            className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`}
            onClick={() => setMobileOpen(false)}
          />
          <div className={`sidebar-mobile ${mobileOpen ? 'open' : ''}`}>
            <Sidebar
              collapsed={false}
              active={activeView}
              onNavigate={handleNavigate}
              onToggle={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar
          onAlarmsClick={() => handleNavigate('alarms')}
          onMenuClick={isMobile ? toggleMobile : undefined}
          showMenu={isMobile}
        />
        <main className="flex-1 overflow-auto">{renderContent()}</main>
      </div>
      <ToastContainer />
    </div>
  );
};
