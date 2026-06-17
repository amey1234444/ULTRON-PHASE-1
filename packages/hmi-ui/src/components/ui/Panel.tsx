import React from 'react';
import { cn } from '../../utils/cn';

export type PanelStatus = 'ok' | 'warning' | 'critical' | 'info' | 'none';

const statusLineClass: Record<PanelStatus, string> = {
  ok:       'status-line-ok',
  warning:  'status-line-warn',
  critical: 'status-line-crit',
  info:     'status-line-info',
  none:     'status-line-none',
};

interface PanelProps {
  title?:        string;
  status?:       PanelStatus;
  actions?:      React.ReactNode;
  className?:    string;
  bodyClass?:    string;
  children:      React.ReactNode;
  noPadding?:    boolean;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  status = 'none',
  actions,
  className,
  bodyClass,
  children,
  noPadding,
}) => (
  <div className={cn('scada-panel flex flex-col min-h-0', statusLineClass[status], className)}>
    {title && (
      <div className="scada-panel-header">
        <span className="scada-panel-title">{title}</span>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    )}
    <div className={cn('flex-1', !noPadding && 'p-3', bodyClass)}>
      {children}
    </div>
  </div>
);
