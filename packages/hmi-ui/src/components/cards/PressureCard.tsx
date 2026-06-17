import React from 'react';
import { useSensorStore }       from '../../store/sensorStore';
import { useThresholdStore }    from '../../store/thresholdStore';
import { Panel }                from '../ui/Panel';
import { StatusBadge }          from '../ui/StatusBadge';
import { SensorGauge }          from './SensorGauge';
import { EditableThreshold }    from '../ui/EditableThreshold';
import { LIMITS }               from '../../config/constants';

const L = LIMITS.pressure;

export const PressureCard: React.FC = () => {
  const latest      = useSensorStore((s) => s.latest);
  const t           = useThresholdStore((s) => s.pressure);
  const setPressure = useThresholdStore((s) => s.setPressure);
  const value  = latest?.pressure ?? 0;

  const status: 'healthy' | 'warning' | 'critical' =
    value >= t.hh || value <= t.ll ? 'critical' :
    value >= t.h  || value <= t.l  ? 'warning'  : 'healthy';

  const panelStatus = status === 'healthy' ? 'ok' as const : status === 'warning' ? 'warning' as const : 'critical' as const;
  const rangePercent = Math.min(100, Math.max(0, ((value - L.min) / (L.max - L.min)) * 100));

  return (
    <Panel title="PRESSURE" status={panelStatus} actions={<StatusBadge status={status} />} noPadding>
      <SensorGauge value={value} min={L.min} max={L.max} unit={L.unit}
        ll={t.ll} l={t.l} h={t.h} hh={t.hh} height={188} />
      <div className="px-3 pb-3">
        <div className="flex justify-between mb-1" style={{ color: 'var(--text-2)' }}>
          <span className="text-2xs font-mono">{L.min} {L.unit}</span>
          <span className="text-2xs font-mono">{L.max} {L.unit}</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{
            width: `${rangePercent}%`,
            background: panelStatus === 'critical' ? 'var(--crit)' : panelStatus === 'warning' ? 'var(--warn)' : 'var(--ok)',
          }} />
        </div>
        <div className="flex justify-between mt-1">
          <EditableThreshold label="LL" value={t.ll} step={0.1} onChange={(v) => setPressure({ ...t, ll: v })} />
          <EditableThreshold label="L"  value={t.l}  step={0.1} onChange={(v) => setPressure({ ...t, l:  v })} />
          <EditableThreshold label="H"  value={t.h}  step={0.1} onChange={(v) => setPressure({ ...t, h:  v })} />
          <EditableThreshold label="HH" value={t.hh} step={0.1} onChange={(v) => setPressure({ ...t, hh: v })} />
        </div>
      </div>
    </Panel>
  );
};
