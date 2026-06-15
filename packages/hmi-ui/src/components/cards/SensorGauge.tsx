import React, { useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  value:   number;
  min:     number;
  max:     number;
  unit:    string;
  ll:      number;
  l:       number;
  h:       number;
  hh:      number;
  height?: number;
  /** When true, gauge shows "—" and greys out — sensor not connected */
  noData?: boolean;
}

function statusColor(v: number, ll: number, l: number, h: number, hh: number, isDark: boolean): string {
  if (v >= hh || v <= ll) return isDark ? '#FF4040' : '#D42020';
  if (v >= h  || v <= l)  return isDark ? '#FFB020' : '#D08000';
  return isDark ? '#20D068' : '#14A854';
}

export const SensorGauge: React.FC<Props> = ({
  value, min, max, unit, ll, l, h, hh, height = 200, noData = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<echarts.ECharts | null>(null);
  const { theme }    = useTheme();
  const isDark       = theme === 'dark';

  const buildOption = useCallback((v: number, dark: boolean): EChartsOption => {
    const color      = statusColor(v, ll, l, h, hh, dark);
    const llPct      = (ll - min) / (max - min);
    const lPct       = (l  - min) / (max - min);
    const hPct       = (h  - min) / (max - min);
    const hhPct      = (hh - min) / (max - min);
    const trackBg    = dark ? 'rgba(18,34,51,0.9)' : 'rgba(216,226,238,1)';
    const labelColor = dark ? '#6AAED0' : '#4A6880';
    const textColor  = dark ? '#CDE4F8' : '#0F1E30';

    void textColor;

    const zoneColors = dark
      ? { crit: 'rgba(255,64,64,0.20)', warn: 'rgba(255,176,32,0.20)', ok: 'rgba(32,208,104,0.18)' }
      : { crit: 'rgba(212,32,32,0.15)', warn: 'rgba(208,128,0,0.15)',  ok: 'rgba(20,168,84,0.15)' };

    return {
      backgroundColor: 'transparent',
      animation: false,
      series: [
        {
          id: 'zones', type: 'gauge',
          startAngle: 210, endAngle: -30, min, max,
          radius: '88%', center: ['50%', '58%'],
          axisLine: { lineStyle: { width: 14, color: [
            [llPct, zoneColors.crit],
            [lPct,  zoneColors.warn],
            [hPct,  zoneColors.ok],
            [hhPct, zoneColors.warn],
            [1,     zoneColors.crit],
          ]}},
          pointer: { show: false }, axisTick: { show: false },
          splitLine: { show: false }, axisLabel: { show: false },
          detail: { show: false }, data: [{ value: 0 }],
        },
        {
          id: 'track', type: 'gauge',
          startAngle: 210, endAngle: -30, min, max,
          radius: '88%', center: ['50%', '58%'],
          axisLine: { lineStyle: { width: 14, color: [[1, trackBg]] } },
          splitNumber: 5,
          axisTick: { show: false },
          splitLine: {
            show: true, distance: -18, length: 8,
            lineStyle: { color: dark ? 'rgba(55,65,81,0.8)' : 'rgba(209,213,219,0.8)', width: 1.5 },
          },
          axisLabel: {
            show: true, distance: -26, fontSize: 11,
            color: labelColor, fontFamily: '"JetBrains Mono", monospace',
            formatter: (v: number) => v === min || v === max ? String(Math.round(v)) : '',
          },
          pointer: { show: false },
          detail: { show: false }, data: [{ value: 0 }],
        },
        {
          id: 'main', type: 'gauge',
          startAngle: 210, endAngle: -30, min, max,
          radius: '88%', center: ['50%', '58%'],
          axisLine: { lineStyle: { width: 0, color: [[1, 'transparent']] } },
          progress: { show: true, roundCap: false, width: 14, itemStyle: { color } },
          pointer: { show: false }, axisTick: { show: false },
          splitLine: { show: false }, axisLabel: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: false,
            offsetCenter: [0, '8%'],
            formatter: noData
              ? () => `{v|—}\n{u|${unit}}`
              : (val: number) => `{v|${val.toFixed(2)}}\n{u|${unit}}`,
            rich: {
              v: {
                fontSize: 30, fontWeight: 700,
                color: noData ? (dark ? 'rgba(100,130,160,0.5)' : 'rgba(100,130,160,0.4)') : color,
                fontFamily: '"JetBrains Mono", monospace',
                lineHeight: 38,
              },
              u: {
                fontSize: 11, color: labelColor,
                fontFamily: 'Inter, sans-serif', lineHeight: 18,
              },
            },
          },
          data: [{ value: noData ? min : v }],
        },
      ],
    };
  }, [min, max, unit, ll, l, h, hh]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, null, { renderer: 'canvas' });
    chartRef.current = chart;
    chart.setOption(buildOption(value, isDark));
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const color = noData
      ? (isDark ? 'rgba(100,130,160,0.5)' : 'rgba(100,130,160,0.4)')
      : statusColor(value, ll, l, h, hh, isDark);
    chartRef.current.setOption({
      series: [{
        id: 'main',
        progress: { itemStyle: { color } },
        detail: {
          formatter: noData
            ? () => `{v|—}\n{u|${unit}}`
            : (val: number) => `{v|${(val as number).toFixed(2)}}\n{u|${unit}}`,
          rich: { v: { color } },
        },
        data: [{ value: noData ? min : value }],
      }],
    });
  }, [value, ll, l, h, hh, isDark, noData, unit, min]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.setOption(buildOption(value, isDark));
  }, [isDark, buildOption, value]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
};
