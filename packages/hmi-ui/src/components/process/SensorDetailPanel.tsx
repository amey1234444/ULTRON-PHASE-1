import React from 'react';
import type { SensorPoint, SensorStatus } from './types';

const STATUS_LABEL: Record<SensorStatus, string> = {
  normal:        'Normal',
  warning:       'Warning',
  alarm:         'Alarm',
  not_installed: 'Not Installed',
};

const PHASE_LABEL: Record<string, string> = {
  phase1: 'Phase 1',
  phase2: 'Phase 2',
  future: 'Future',
};

interface Props {
  sensor:  SensorPoint;
  onClose: () => void;
}

export const SensorDetailPanel: React.FC<Props> = ({ sensor, onClose }) => {
  const isInstalled = sensor.status !== 'not_installed';

  const statusColor = {
    normal:        'var(--ok)',
    warning:       'var(--warn)',
    alarm:         'var(--crit)',
    not_installed: 'var(--border-hi)',
  }[sensor.status];

  const displayValue =
    sensor.value !== null && sensor.value !== undefined
      ? typeof sensor.value === 'number'
        ? sensor.value.toFixed(sensor.unit === 'bar' ? 2 : 1)
        : String(sensor.value)
      : '--';

  return (
    <div
      style={{
        position: 'absolute',
        top: 4, right: 4,
        width: 220,
        background: 'var(--panel)',
        border: '1px solid var(--border-hi)',
        borderTop: `2px solid ${statusColor}`,
        borderRadius: 2,
        zIndex: 20,
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px 6px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 7, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--text-2)',
          }}>
            SENSOR DETAIL
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', fontSize: 14, lineHeight: 1,
            padding: '0 2px',
          }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 10px 12px' }}>
        {/* Tag + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            fontFamily: 'Roboto Mono, monospace',
            fontSize: 18, fontWeight: 700,
            color: statusColor,
            letterSpacing: '-0.5px',
          }}>
            {sensor.tag}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: statusColor,
            background: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
            padding: '2px 5px', borderRadius: 2,
          }}>
            {STATUS_LABEL[sensor.status]}
          </span>
        </div>

        {/* Name */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
          {sensor.name}
        </div>

        {/* Value */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 2,
          padding: '8px 10px',
          marginBottom: 10,
          display: 'flex', alignItems: 'baseline', gap: 5,
        }}>
          <span style={{
            fontFamily: 'Roboto Mono, monospace',
            fontSize: 24, fontWeight: 700,
            color: isInstalled ? statusColor : 'var(--border-hi)',
          }}>
            {displayValue}
          </span>
          {sensor.unit && (
            <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{sensor.unit}</span>
          )}
        </div>

        {/* Metadata rows */}
        {[
          ['Location',    sensor.location],
          ['Phase',       PHASE_LABEL[sensor.phase] ?? sensor.phase],
          ['Installed',   isInstalled ? 'Yes' : 'Planned'],
        ].map(([label, val]) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '3px 0',
            borderBottom: '1px solid var(--border)',
            fontSize: 9.5,
          }}>
            <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {label}
            </span>
            <span style={{ color: 'var(--text-2)', textAlign: 'right', maxWidth: 120 }}>
              {val}
            </span>
          </div>
        ))}

        {/* Description */}
        <p style={{
          marginTop: 8, marginBottom: 0,
          fontSize: 9.5, lineHeight: 1.5,
          color: 'var(--text-3)',
        }}>
          {sensor.description}
        </p>

        {/* Not installed note */}
        {!isInstalled && (
          <div style={{
            marginTop: 8, padding: '5px 7px',
            background: 'var(--panel-alt)',
            border: '1px solid var(--border)',
            borderRadius: 2,
            fontSize: 9, color: 'var(--text-3)', lineHeight: 1.5,
          }}>
            Planned for {PHASE_LABEL[sensor.phase]}. Value will appear once sensor is installed and wired.
          </div>
        )}
      </div>
    </div>
  );
};
