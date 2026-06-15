import React from 'react';
import { Panel, type PanelStatus } from './Panel';
import { cn } from '../../utils/cn';
import type { SystemStatus } from '../../types/sensor';

function toPanelStatus(accent: SystemStatus | 'default' | undefined): PanelStatus {
  if (!accent || accent === 'default') return 'none';
  if (accent === 'healthy') return 'ok';
  if (accent === 'warning') return 'warning';
  if (accent === 'critical') return 'critical';
  return 'none';
}

interface GlassCardProps {
  children:   React.ReactNode;
  className?: string;
  accent?:    SystemStatus | 'default';
  label?:     string;
  labelIcon?: React.ReactNode;
  extra?:     React.ReactNode;
  glow?:      boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  accent,
  label,
  extra,
  labelIcon,
}) => (
  <Panel
    title={label}
    status={toPanelStatus(accent)}
    actions={extra}
    className={className}
    noPadding
  >
    {children}
  </Panel>
);
