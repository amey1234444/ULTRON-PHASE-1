import React from 'react';
import { useSensorStore }     from '../../store/sensorStore';
import { useThresholdStore }  from '../../store/thresholdStore';
import { Panel }              from '../ui/Panel';
import { StatusBadge }        from '../ui/StatusBadge';
import { SensorGauge }        from './SensorGauge';
import { EditableThreshold }  from '../ui/EditableThreshold';
import { LIMITS }             from '../../config/constants';

const L = LIMITS.temperature;

export const TemperatureCard: React.FC = () => {
  const latest         = useSensorStore((s) => s.latest);
  const t              = useThresholdStore((s) => s.temperature);
  const setTemperature = useThresholdStore((s) => s.setTemperature);
  // null = DS18B20 not connected; show "—" and suppress alarms
  const rawTemp = latest?.temperature ?? null;
  const value   = rawTemp ?? 0;
  const noSensor = rawTemp === null;

  const status: 'healthy' | 'warning' | 'critical' =
    noSensor ? 'healthy' :                                        // no sensor → no alarm
    value >= t.hh || value <= t.ll ? 'critical' :
    value >= t.h  || value <= t.l  ? 'warning'  : 'healthy';

  const panelStatus = status === 'healthy' ? 'ok' as const : status === 'warning' ? 'warning' as const : 'critical' as const;
  const rangePercent = noSensor ? 0 : Math.min(100, Math.max(0, ((value - L.min) / (L.max - L.min)) * 100));

  return (
    <Panel title="TEMPERATURE" status={panelStatus}
      actions={noSensor ? <span className="text-2xs font-mono" style={{ color: 'var(--text-3)' }}>NO SENSOR</span> : <StatusBadge status={status} />}
      noPadding>
      <SensorGauge value={noSensor ? 0 : value} min={L.min} max={L.max} unit={L.unit}
        ll={t.ll} l={t.l} h={t.h} hh={t.hh} height={188}
        noData={noSensor} />
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
          <EditableThreshold label="LL" value={t.ll} step={0.5} onChange={(v) => setTemperature({ ...t, ll: v })} />
          <EditableThreshold label="L"  value={t.l}  step={0.5} onChange={(v) => setTemperature({ ...t, l:  v })} />
          <EditableThreshold label="H"  value={t.h}  step={0.5} onChange={(v) => setTemperature({ ...t, h:  v })} />
          <EditableThreshold label="HH" value={t.hh} step={0.5} onChange={(v) => setTemperature({ ...t, hh: v })} />
        </div>
      </div>
    </Panel>
  );
};
