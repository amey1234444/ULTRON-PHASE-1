import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { useSensorStore }    from '../../store/sensorStore';
import { useThresholdStore } from '../../store/thresholdStore';
import { Panel }             from '../ui/Panel';
import { EditableThreshold } from '../ui/EditableThreshold';
import { getHealthColor }    from '../../utils/formatters';
import { useTheme }          from '../../context/ThemeContext';

function getStatusLabel(score: number): string {
  if (score >= 70) return 'NOMINAL';
  if (score >= 40) return 'DEGRADED';
  return 'CRITICAL';
}

export const HealthScoreCard: React.FC = () => {
  const score      = useSensorStore((s) => s.healthScore);
  const alarms     = useSensorStore((s) => s.alarms);
  const ht         = useThresholdStore((s) => s.health);
  const setHealth  = useThresholdStore((s) => s.setHealth);
  const status     = score <= ht.ll ? 'critical' : score <= ht.l ? 'warning' : 'healthy';
  const color      = getHealthColor(score);
  const { theme }  = useTheme();
  const isDark     = theme === 'dark';
  const chartRef   = useRef<HTMLDivElement>(null);
  const ecRef      = useRef<echarts.ECharts | null>(null);

  const panelStatus = status === 'healthy' ? 'ok' as const : status === 'warning' ? 'warning' as const : 'critical' as const;

  const activeAlarms = Object.values(alarms).filter(Boolean).length;

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current, null, { renderer: 'canvas' });
    ecRef.current = chart;
    const trackBg = isDark ? 'rgba(18,34,51,0.9)' : 'rgba(216,226,238,1)';
    chart.setOption({
      backgroundColor: 'transparent',
      series: [{
        type: 'gauge',
        startAngle: 210, endAngle: -30,
        min: 0, max: 100,
        radius: '88%', center: ['50%', '60%'],
        axisLine: { lineStyle: { width: 12, color: [[1, trackBg]] } },
        progress: { show: true, roundCap: false, width: 12, itemStyle: { color } },
        pointer: { show: false }, axisTick: { show: false },
        splitLine: { show: false }, axisLabel: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '5%'],
          formatter: (val: number) => `{v|${Math.round(val)}}\n{u|/ 100}`,
          rich: {
            v: { fontSize: 32, fontWeight: 700, color, fontFamily: '"JetBrains Mono", monospace', lineHeight: 40 },
            u: { fontSize: 11, color: isDark ? '#6AAED0' : '#4A6880', fontFamily: 'Inter, sans-serif', lineHeight: 18 },
          },
        },
        data: [{ value: score }],
      }],
    });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.dispose(); ecRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ecRef.current) return;
    ecRef.current.setOption({
      series: [{
        progress: { itemStyle: { color } },
        detail:   { rich: { v: { color } } },
        data:     [{ value: score }],
      }],
    });
  }, [score, color]);

  return (
    <Panel title="SYSTEM HEALTH" status={panelStatus} noPadding>
      <div ref={chartRef} className="w-full" style={{ height: 188 }} />
      <div className="px-3 pb-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-bold tracking-widest" style={{ color }}>
            {getStatusLabel(score)}
          </span>
          <span className="text-2xs" style={{ color: 'var(--text-3)' }}>
            {activeAlarms === 0 ? 'ALL CLEAR' : `${activeAlarms} ALARM${activeAlarms > 1 ? 'S' : ''}`}
          </span>
        </div>
        <div className="flex justify-between mt-1">
          <EditableThreshold label="LL ≤" value={ht.ll} step={1} onChange={(v) => setHealth({ ...ht, ll: v })} />
          <EditableThreshold label="L ≤"  value={ht.l}  step={1} onChange={(v) => setHealth({ ...ht, l:  v })} />
        </div>
      </div>
    </Panel>
  );
};
