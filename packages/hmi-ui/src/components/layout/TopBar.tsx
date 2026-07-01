import React from 'react';
import { useSensorStore }    from '../../store/sensorStore';
import { useConnectionStore } from '../../store/connectionStore';
import { useTheme }          from '../../context/ThemeContext';
import { ClockDisplay }      from '../ui/ClockDisplay';
import { cn }                from '../../utils/cn';
import type { DataProtocol } from '../../services/device/ConnectionTypes';
import type { SidebarView }  from './Sidebar';

// ── Icons ─────────────────────────────────────────────────────────────────────

const SunIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx={12} cy={12} r={5} />
    <line x1={12} y1={1} x2={12} y2={3} />
    <line x1={12} y1={21} x2={12} y2={23} />
    <line x1={4.22} y1={4.22} x2={5.64} y2={5.64} />
    <line x1={18.36} y1={18.36} x2={19.78} y2={19.78} />
    <line x1={1} y1={12} x2={3} y2={12} />
    <line x1={21} y1={12} x2={23} y2={12} />
    <line x1={4.22} y1={19.78} x2={5.64} y2={18.36} />
    <line x1={18.36} y1={5.64} x2={19.78} y2={4.22} />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <line x1={3} y1={6} x2={21} y2={6} />
    <line x1={3} y1={12} x2={21} y2={12} />
    <line x1={3} y1={18} x2={21} y2={18} />
  </svg>
);

// ── Sub-components ────────────────────────────────────────────────────────────

function ConnStatus() {
  const status = useSensorStore((s) => s.connectionStatus);
  const colors: Record<string, string> = {
    connected:    'var(--ok)',
    connecting:   'var(--warn)',
    disconnected: 'var(--text-3)',
    error:        'var(--crit)',
  };
  const labels: Record<string, string> = {
    connected:    'CONNECTED',
    connecting:   'CONNECTING',
    disconnected: 'OFFLINE',
    error:        'ERROR',
  };
  const color = colors[status] ?? 'var(--text-3)';
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn('status-dot', status === 'connecting' && 'animate-status-pulse')}
        style={{ background: color }}
      />
      <span className="text-2xs font-semibold tracking-widest hidden sm:inline" style={{ color }}>
        {labels[status] ?? status.toUpperCase()}
      </span>
    </div>
  );
}

const PROTOCOL_SHORT: Record<DataProtocol, string> = {
  'websocket':          'WS',
  'modbus':             'MODBUS',
  'none':               '\u2014',
};

const PROTOCOL_COLOR: Record<DataProtocol, string> = {
  'websocket':          'var(--ok)',
  'modbus':             'var(--warn)',
  'none':               'var(--text-3)',
};

const MAX_DISPLAY_LATENCY = 9999;

function DeviceInfo() {
  const config         = useConnectionStore((s) => s.config);
  const latencyMs      = useSensorStore((s) => s.latencyMs);
  const activeProtocol = useSensorStore((s) => s.activeDataProtocol);

  if (!config) return null;

  const sep = <span style={{ color: 'var(--border-hi)' }}>\u00b7</span>;

  const cappedLatency = latencyMs > MAX_DISPLAY_LATENCY ? MAX_DISPLAY_LATENCY : latencyMs;
  const showLatency = activeProtocol === 'websocket';
  const latencyColor =
    cappedLatency === 0  ? 'var(--text-3)' :
    cappedLatency < 50   ? 'var(--ok)'     :
    cappedLatency < 200  ? 'var(--warn)'   : 'var(--crit)';
  const latencyLabel = cappedLatency === 0 ? '\u2014 ms' : `${cappedLatency} ms`;

  const protoLabel = PROTOCOL_SHORT[activeProtocol];
  const protoColor = PROTOCOL_COLOR[activeProtocol];

  return (
    <div className="flex items-center gap-2 text-2xs font-mono overflow-hidden">
      <span className="truncate max-w-[140px] hidden md:inline" style={{ color: 'var(--text-2)' }}>
        {config.deviceName}
      </span>
      <span className="hidden lg:inline" style={{ color: 'var(--text-2)' }}>{config.deviceIp}</span>
      <span className="hidden lg:inline">{sep}</span>
      <span className="font-semibold" style={{ color: protoColor }}>
        {protoLabel}
      </span>
      {showLatency && (
        <>
          {sep}
          <span style={{ color: latencyColor }}>{latencyLabel}</span>
        </>
      )}
    </div>
  );
}

function AlarmBadge({ onClick }: { onClick?: () => void }) {
  const alarms     = useSensorStore((s) => s.alarms);
  const activeCount = Object.values(alarms).filter(Boolean).length;
  const hasCrit    = alarms.hhPressure || alarms.hhTemperature || alarms.llPressure || alarms.llTemperature;

  return (
    <button
      onClick={onClick}
      title="View alarm panel"
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded',
        activeCount > 0 && hasCrit && 'alarm-flash',
      )}
      style={{
        background: activeCount > 0 ? (hasCrit ? 'var(--crit-dim)' : 'var(--warn-dim)') : 'transparent',
        border: `1px solid ${activeCount > 0 ? (hasCrit ? 'var(--crit)' : 'var(--warn)') : 'var(--border)'}`,
        cursor: 'pointer',
      }}
    >
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}
        style={{ color: activeCount > 0 ? (hasCrit ? 'var(--crit)' : 'var(--warn)') : 'var(--text-3)' }}>
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
      </svg>
      <span
        className="text-2xs font-bold tracking-wider hidden sm:inline"
        style={{ color: activeCount > 0 ? (hasCrit ? 'var(--crit)' : 'var(--warn)') : 'var(--text-3)' }}
      >
        {activeCount > 0 ? `${activeCount} ALARM${activeCount > 1 ? 'S' : ''}` : 'NO ALARM'}
      </span>
    </button>
  );
}

// ── Nav tab definitions ───────────────────────────────────────────────────────

interface NavTab {
  id: SidebarView;
  label: string;
}

const NAV_TABS: NavTab[] = [
  { id: 'overview',    label: 'Overview' },
  { id: 'trends',      label: 'Trends' },
  { id: 'alarms',      label: 'Alarms' },
  { id: 'devices',     label: 'Devices' },
  { id: 'monitoring',  label: 'Monitoring' },
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'reports',     label: 'Reports' },
  { id: 'settings',    label: 'Settings' },
];

// ── TopBar component ──────────────────────────────────────────────────────────

interface TopBarProps {
  activeView?:   SidebarView;
  onNavigate?:   (v: SidebarView) => void;
  onAlarmsClick?: () => void;
  onMenuClick?:  () => void;
  showMenu?:     boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ activeView, onNavigate, onAlarmsClick, onMenuClick, showMenu }) => {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex-shrink-0" style={{ background: 'var(--topbar)' }}>
      {/* Row 1: Status bar */}
      <header
        className="flex items-center h-12 px-2 sm:px-4 gap-2 sm:gap-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        {showMenu && (
          <button onClick={onMenuClick} className="hamburger-btn" title="Open menu">
            <MenuIcon />
          </button>
        )}

        <ConnStatus />

        <div className="h-4 w-px hidden sm:block" style={{ background: 'var(--border-hi)' }} />

        <div className="flex-1 min-w-0">
          <DeviceInfo />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <AlarmBadge onClick={onAlarmsClick} />
          <div className="h-4 w-px hidden sm:block" style={{ background: 'var(--border-hi)' }} />
          <div className="hidden sm:block"><ClockDisplay /></div>
          <div className="h-4 w-px hidden sm:block" style={{ background: 'var(--border-hi)' }} />
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center justify-center w-7 h-7 rounded transition-colors"
            style={{ color: 'var(--text-2)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; }}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      {/* Row 2: Navigation tabs */}
      {onNavigate && (
        <nav
          className="flex items-center h-10 px-2 sm:px-4 gap-1 border-b overflow-x-auto scrollbar-hide"
          style={{ borderColor: 'var(--border)' }}
        >
          {NAV_TABS.map((tab) => {
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className={cn(
                  'nav-tab',
                  isActive && 'nav-tab-active',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};
