import React from 'react';
import { cn } from '../../utils/cn';
import { AssetExplorer } from './AssetExplorer';

export type SidebarView =
  | 'overview'
  | 'trends'
  | 'alarms'
  | 'devices'
  | 'monitoring'
  | 'diagnostics'
  | 'maintenance'
  | 'reports'
  | 'settings';

interface NavItem {
  id:    SidebarView;
  label: string;
  icon:  React.ReactNode;
}

const IconOverview = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x={3} y={3} width={7} height={7} rx={1} />
    <rect x={14} y={3} width={7} height={7} rx={1} />
    <rect x={3} y={14} width={7} height={7} rx={1} />
    <rect x={14} y={14} width={7} height={7} rx={1} />
  </svg>
);
const IconTrends = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);
const IconAlarms = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);
const IconDevices = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x={2} y={3} width={20} height={14} rx={2} />
    <path d="M8 21h8M12 17v4" />
  </svg>
);
const IconDiag = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IconMaint = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
  </svg>
);
const IconReports = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1={16} y1={13} x2={8} y2={13} />
    <line x1={16} y1={17} x2={8} y2={17} />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);
const IconSettings = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <circle cx={12} cy={12} r={3} />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);
const IconMonitoring = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x={2} y={2} width={20} height={8} rx={2} />
    <rect x={2} y={14} width={20} height={8} rx={2} />
    <path d="M6 6h.01M6 18h.01" />
  </svg>
);
const IconChevron = ({ collapsed }: { collapsed: boolean }) => (
  <svg viewBox="0 0 24 24" className={cn('w-4 h-4 transition-transform duration-200', collapsed && 'rotate-180')}
    fill="none" stroke="currentColor" strokeWidth={2}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const NAV_PRIMARY: NavItem[] = [
  { id: 'overview',    label: 'Overview',    icon: <IconOverview /> },
  { id: 'trends',      label: 'Trends',      icon: <IconTrends /> },
  { id: 'alarms',      label: 'Alarms',      icon: <IconAlarms /> },
  { id: 'devices',     label: 'Devices',     icon: <IconDevices /> },
  { id: 'monitoring',  label: 'Monitoring',  icon: <IconMonitoring /> },
  { id: 'diagnostics', label: 'Diagnostics', icon: <IconDiag /> },
];
const NAV_SECONDARY: NavItem[] = [
  { id: 'maintenance', label: 'Maintenance', icon: <IconMaint /> },
  { id: 'reports',     label: 'Reports',     icon: <IconReports /> },
  { id: 'settings',    label: 'Settings',    icon: <IconSettings /> },
];

interface SidebarProps {
  collapsed:  boolean;
  active:     SidebarView;
  onNavigate: (v: SidebarView) => void;
  onToggle:   () => void;
}

function NavGroup({ items, active, onNavigate, collapsed }: {
  items: NavItem[];
  active: SidebarView;
  onNavigate: (v: SidebarView) => void;
  collapsed: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          title={collapsed ? item.label : undefined}
          className={cn('sidebar-item', active === item.id && 'active')}
        >
          <span className="flex-shrink-0">{item.icon}</span>
          {!collapsed && <span>{item.label}</span>}
        </button>
      ))}
    </div>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, active, onNavigate, onToggle }) => {
  return (
    <aside
      className={cn(
        'flex flex-col h-full flex-shrink-0 overflow-hidden',
        'border-r transition-all duration-200',
        collapsed ? 'w-[56px]' : 'w-[220px] max-w-[80vw]',
      )}
      style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}
    >
      {/* Logo area */}
      <div className={cn(
        'flex items-center h-12 border-b flex-shrink-0',
        collapsed ? 'justify-center px-0' : 'px-3 gap-2.5',
      )} style={{ borderColor: 'var(--border)' }}>
        <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md"
          style={{ background: 'var(--accent-dim)', boxShadow: '0 0 12px rgba(56,160,255,0.1)' }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="var(--accent)" strokeWidth={2}>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        {!collapsed && (
          <div>
            <div className="text-xs font-black tracking-[0.15em]" style={{ color: 'var(--text)' }}>ULTRON</div>
            <div className="text-3xs" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>CONTROL SYSTEM</div>
          </div>
        )}
      </div>

      <AssetExplorer collapsed={collapsed} />

      {/* Nav primary */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-1.5">
        {!collapsed && (
          <div className="px-2 pb-1 pt-1">
            <span className="text-2xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-2)' }}>Monitor</span>
          </div>
        )}
        <NavGroup items={NAV_PRIMARY} active={active} onNavigate={onNavigate} collapsed={collapsed} />

        <div className={cn('my-2 border-t', collapsed ? 'mx-1' : 'mx-2')} style={{ borderColor: 'var(--border)' }} />

        {!collapsed && (
          <div className="px-2 pb-1">
            <span className="text-2xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-2)' }}>System</span>
          </div>
        )}
        <NavGroup items={NAV_SECONDARY} active={active} onNavigate={onNavigate} collapsed={collapsed} />
      </div>

      {/* Collapse toggle */}
      <div className="flex-shrink-0 border-t px-1.5 py-1.5" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'sidebar-item w-full',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && <span>Collapse</span>}
          <IconChevron collapsed={!collapsed} />
        </button>
      </div>
    </aside>
  );
};
