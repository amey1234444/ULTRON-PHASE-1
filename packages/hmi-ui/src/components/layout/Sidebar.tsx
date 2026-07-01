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

interface SidebarProps {
  collapsed:  boolean;
  onToggle:   () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  return (
    <aside
      className={cn(
        'flex flex-col h-full flex-shrink-0 overflow-hidden',
        'border-r transition-all duration-200',
        collapsed ? 'w-[56px]' : 'w-[220px] max-w-[80vw]',
      )}
      style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}
    >
      {/* Logo area — click to toggle sidebar */}
      <button
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'flex items-center h-12 border-b flex-shrink-0 w-full',
          'hover:opacity-80 transition-opacity cursor-pointer',
          collapsed ? 'justify-center px-0' : 'px-3 gap-2.5',
        )}
        style={{ borderColor: 'var(--border)', background: 'transparent' }}
      >
        <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md"
          style={{ background: 'var(--accent-dim)', boxShadow: '0 0 12px rgba(56,160,255,0.1)' }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="var(--accent)" strokeWidth={2}>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        {!collapsed && (
          <div className="text-left">
            <div className="text-xs font-black tracking-[0.15em]" style={{ color: 'var(--text)' }}>ULTRON</div>
            <div className="text-3xs" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>CONTROL SYSTEM</div>
          </div>
        )}
      </button>

      {/* Asset hierarchy explorer */}
      <AssetExplorer collapsed={collapsed} />
    </aside>
  );
};
