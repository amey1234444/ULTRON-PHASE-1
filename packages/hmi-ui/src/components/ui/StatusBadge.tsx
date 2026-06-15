import React from 'react';
import { cn } from '../../utils/cn';
import type { SystemStatus, ConnectionStatus } from '../../types/sensor';

function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span
      className={cn('status-dot', pulse && 'animate-status-pulse')}
      style={{ background: color }}
    />
  );
}

const sysColors: Record<SystemStatus, string> = {
  healthy:  'var(--ok)',
  warning:  'var(--warn)',
  critical: 'var(--crit)',
  offline:  'var(--text-3)',
};
const sysLabels: Record<SystemStatus, string> = {
  healthy:  'HEALTHY',
  warning:  'WARNING',
  critical: 'CRITICAL',
  offline:  'OFFLINE',
};

export const StatusBadge: React.FC<{
  status:     SystemStatus;
  showLabel?: boolean;
  className?: string;
}> = ({ status, showLabel = true, className }) => {
  const color = sysColors[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Dot color={color} pulse={status === 'warning' || status === 'critical'} />
      {showLabel && (
        <span className="text-2xs font-bold tracking-widest" style={{ color }}>
          {sysLabels[status]}
        </span>
      )}
    </span>
  );
};

const connColors: Record<ConnectionStatus, string> = {
  connected:    'var(--ok)',
  connecting:   'var(--warn)',
  disconnected: 'var(--text-3)',
  error:        'var(--crit)',
};
const connLabels: Record<ConnectionStatus, string> = {
  connected:    'ONLINE',
  connecting:   'CONNECTING',
  disconnected: 'OFFLINE',
  error:        'ERROR',
};

export const ConnectionBadge: React.FC<{
  status:     ConnectionStatus;
  className?: string;
}> = ({ status, className }) => {
  const color = connColors[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Dot color={color} pulse={status === 'connecting' || status === 'error'} />
      <span className="text-2xs font-bold tracking-widest" style={{ color }}>
        {connLabels[status]}
      </span>
    </span>
  );
};
