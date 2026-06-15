import React, { useState, useMemo, useEffect } from 'react';
import { useSensorStore }    from '../../store/sensorStore';
import { useConnectionStore } from '../../store/connectionStore';
import { useTheme }          from '../../context/ThemeContext';
import { Panel }             from '../ui/Panel';
import type { PanelStatus }  from '../ui/Panel';
import { RotaryAirlockValveSvg } from '../process/RotaryAirlockValveSvg';
import { SensorDetailPanel }     from '../process/SensorDetailPanel';
import { buildSensorPoints }     from '../process/sensorPoints';
import type { SensorPoint, SensorStatus } from '../process/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function worstStatus(points: SensorPoint[]): SensorStatus {
  const inst = points.filter((p) => p.installed);
  if (inst.some((p) => p.status === 'alarm'))   return 'alarm';
  if (inst.some((p) => p.status === 'warning')) return 'warning';
  return 'normal';
}

function toPanelStatus(s: SensorStatus): PanelStatus {
  if (s === 'alarm')   return 'critical';
  if (s === 'warning') return 'warning';
  return 'ok';
}

function protocolLabel(proto: string | undefined): string {
  const map: Record<string, string> = { simulation: 'SIM', lan: 'LAN', wifi: 'WiFi', manual: 'TCP' };
  return proto ? (map[proto] ?? proto.toUpperCase()) : 'Offline';
}

// ── Legend ────────────────────────────────────────────────────────────────────

const LEGEND = [
  { color: 'var(--ok)',        label: 'Normal'        },
  { color: 'var(--warn)',      label: 'Warning'       },
  { color: 'var(--crit)',      label: 'Alarm'         },
  { color: 'var(--border-hi)', label: 'Not Installed' },
] as const;

const Legend: React.FC = () => (
  <div style={{
    display: 'flex', gap: 16, padding: '6px 10px 5px',
    borderTop: '1px solid var(--border)', flexWrap: 'wrap',
  }}>
    {LEGEND.map(({ color, label }) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{
          fontSize: 10, color: 'var(--text-2)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>{label}</span>
      </div>
    ))}
  </div>
);

// ── Fullscreen overlay ────────────────────────────────────────────────────────

interface FullscreenProps {
  sensorPoints:    SensorPoint[];
  initialSensor:   SensorPoint | null;
  isDark:          boolean;
  onClose:         () => void;
}

const FullscreenOverlay: React.FC<FullscreenProps> = ({
  sensorPoints, initialSensor, isDark, onClose,
}) => {
  const [selectedSensor, setSelectedSensor] = useState<SensorPoint | null>(initialSensor);
  const [hoveredTag,     setHoveredTag]     = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: isDark ? 'rgba(7,12,20,0.97)' : 'rgba(240,243,248,0.97)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--panel)',
      }}>
        <div>
          <span style={{
            fontSize: 13, fontWeight: 700, letterSpacing: '2px',
            color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            ROTARY AIRLOCK VALVE
          </span>
          <span style={{
            marginLeft: 10, fontSize: 11, color: 'var(--text-3)',
            fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '1px',
          }}>
            RAV-01 · Digital Twin
          </span>
        </div>
        <button
          onClick={onClose}
          title="Close (Esc)"
          style={{
            background: 'var(--panel-alt)', border: '1px solid var(--border)',
            borderRadius: 2, cursor: 'pointer',
            padding: '5px 14px', color: 'var(--text-2)',
            fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>⊠</span>
          Close
        </button>
      </div>

      {/* SVG area — fills all remaining height, no scroll */}
      <div style={{
        flex: 1, overflow: 'hidden',
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '8px 16px',
      }}>
        <div style={{
          width: '100%', height: '100%',
          position: 'relative',
          display: 'flex', alignItems: 'center',
        }}>
          <RotaryAirlockValveSvg
            sensorPoints={sensorPoints}
            selectedTag={selectedSensor?.tag ?? null}
            hoveredTag={hoveredTag}
            isDark={isDark}
            fillContainer
            onSensorClick={(s) =>
              setSelectedSensor((prev) => prev?.tag === s.tag ? null : s)
            }
            onSensorHover={setHoveredTag}
          />
          {selectedSensor && (
            <SensorDetailPanel
              sensor={selectedSensor}
              onClose={() => setSelectedSensor(null)}
            />
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ flexShrink: 0, background: 'var(--panel)' }}>
        <Legend />
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export const ProcessOverview: React.FC = () => {
  const [hoveredTag,     setHoveredTag]     = useState<string | null>(null);
  const [fullscreen,     setFullscreen]     = useState(false);
  const [preselected,    setPreselected]    = useState<SensorPoint | null>(null);

  const { theme }        = useTheme();
  const isDark           = theme === 'dark';
  const latest           = useSensorStore((s) => s.latest);
  const connectionStatus = useSensorStore((s) => s.connectionStatus);
  const config           = useConnectionStore((s) => s.config);

  const sensorPoints = useMemo(() => buildSensorPoints(latest), [latest]);
  const overall      = worstStatus(sensorPoints);
  const panelStatus  = toPanelStatus(overall);
  const protoStr     = protocolLabel(config?.protocol);
  const connOk       = connectionStatus === 'connected';

  const statusLabel = overall === 'alarm' ? 'ALARM' : overall === 'warning' ? 'WARNING' : 'NORMAL';
  const statusColor = overall === 'alarm' ? 'var(--crit)' : overall === 'warning' ? 'var(--warn)' : 'var(--ok)';

  function openFullscreen(sensor?: SensorPoint) {
    setPreselected(sensor ?? null);
    setFullscreen(true);
  }

  const headerActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontSize: 8, fontWeight: 700, letterSpacing: '0.10em',
        padding: '2px 7px', borderRadius: 2,
        color: statusColor,
        border: `1px solid ${statusColor}`,
        background: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
      }}>
        {statusLabel}
      </span>
      <span style={{
        fontSize: 8, letterSpacing: '0.06em',
        color: connOk ? 'var(--accent)' : 'var(--text-3)',
        background: connOk ? 'var(--accent-dim)' : 'var(--panel-alt)',
        padding: '2px 6px', borderRadius: 2,
        border: '1px solid var(--border)',
      }}>
        {protoStr}
      </span>
    </div>
  );

  return (
    <>
      <Panel
        title="ROTARY AIRLOCK VALVE"
        status={panelStatus}
        actions={headerActions}
        noPadding
        className="h-full"
        bodyClass="flex flex-col min-h-0"
      >
        {/* Machine ID sub-header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 10px 3px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}>
          <span style={{
            fontSize: 8, fontWeight: 600, letterSpacing: '1.2px',
            color: 'var(--text-3)', textTransform: 'uppercase',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            RAV-01 · Digital Twin · Click to expand
          </span>
          {latest && (
            <span style={{
              fontSize: 8, color: 'var(--text-3)',
              fontFamily: '"Roboto Mono", monospace',
            }}>
              {new Date(latest.timestamp).toLocaleTimeString('en-US', { hour12: false })}
            </span>
          )}
        </div>

        {/* SVG diagram — fills flex space, no overflow; preserveAspectRatio centers content */}
        <div
          style={{
            position: 'relative',
            cursor: 'pointer',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
          onClick={() => openFullscreen()}
        >
          <RotaryAirlockValveSvg
            sensorPoints={sensorPoints}
            selectedTag={null}
            hoveredTag={hoveredTag}
            isDark={isDark}
            fillContainer
            onSensorClick={(s) => openFullscreen(s)}
            onSensorHover={setHoveredTag}
          />
        </div>

        <Legend />
      </Panel>

      {fullscreen && (
        <FullscreenOverlay
          sensorPoints={sensorPoints}
          initialSensor={preselected}
          isDark={isDark}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );
};
