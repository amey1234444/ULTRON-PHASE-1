import React, { useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { Panel }              from '../ui/Panel';
import { useSensorStore }     from '../../store/sensorStore';
import { useThresholdStore }  from '../../store/thresholdStore';
import { useTheme }           from '../../context/ThemeContext';
import { LIMITS, type SensorType } from '../../config/constants';
import { formatTimestamp }    from '../../utils/formatters';
import type { SensorReading } from '../../types/sensor';

function formatHistTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    });
  } catch { return '--'; }
}

interface Props {
  type: SensorType;
  /** When provided, display this data instead of the live store. */
  readings?: SensorReading[];
}

const SERIES_COLORS: Record<SensorType, { line: string; area: string }> = {
  pressure:    { line: '#3B82F6', area: 'rgba(59,130,246,0.12)' },
  temperature: { line: '#F59E0B', area: 'rgba(245,158,11,0.12)' },
};
const SERIES_COLORS_LIGHT: Record<SensorType, { line: string; area: string }> = {
  pressure:    { line: '#2563EB', area: 'rgba(37,99,235,0.10)' },
  temperature: { line: '#D97706', area: 'rgba(217,119,6,0.10)' },
};

export const TrendChart: React.FC<Props> = ({ type, readings: externalReadings }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<echarts.ECharts | null>(null);
  const { theme }    = useTheme();
  const isDark       = theme === 'dark';
  const L            = LIMITS[type];
  const storeReadingCount = useSensorStore((s) =>
    externalReadings !== undefined ? 0 : s.readings.length,
  );
  const readingCount = externalReadings?.length ?? storeReadingCount;
  const title        = type === 'pressure' ? 'PRESSURE TREND' : 'TEMPERATURE TREND';
  const isHistorical = externalReadings !== undefined && externalReadings.length > 1000;
  const formatX      = isHistorical ? formatHistTs : formatTimestamp;

  const thresholds = useThresholdStore((s) => type === 'pressure' ? s.pressure : s.temperature);

  const unit = type === 'pressure' ? ' bar' : '°C';

  const buildOption = useCallback((dark: boolean): EChartsOption => {
    const colors   = dark ? SERIES_COLORS[type] : SERIES_COLORS_LIGHT[type];
    const gridLine = dark ? 'rgba(31,41,55,1)' : 'rgba(229,231,235,1)';
    const axLabel  = dark ? '#6B7280' : '#9CA3AF';
    const tooltipBg   = dark ? '#1F2937' : '#FFFFFF';
    const tooltipBdr  = dark ? '#374151' : '#E5E7EB';
    const tooltipText = dark ? '#E5E7EB' : '#111827';
    const warnColor = dark ? '#F59E0B' : '#D97706';
    const critColor = dark ? '#EF4444' : '#DC2626';

    const { ll, l, h, hh } = thresholds;

    return {
      backgroundColor: 'transparent',
      animation: false,
      grid: { top: 28, right: 20, bottom: 48, left: 52, containLabel: false },
      dataZoom: [
        { type: 'inside', start: isHistorical ? 0 : 70, end: 100, zoomOnMouseWheel: true, moveOnMouseMove: true },
        { type: 'slider', start: isHistorical ? 0 : 70, end: 100, height: 18, bottom: 4,
          borderColor: dark ? '#374151' : '#D1D5DB',
          backgroundColor: dark ? '#111827' : '#F3F4F6',
          fillerColor: dark ? 'rgba(59,130,246,0.15)' : 'rgba(37,99,235,0.10)',
          handleStyle: { color: dark ? '#3B82F6' : '#2563EB' },
          textStyle: { color: axLabel, fontSize: 9 },
        },
      ],
      xAxis: {
        type: 'category', data: [] as string[], boundaryGap: false,
        axisLine: { lineStyle: { color: gridLine } },
        axisTick: { show: false },
        axisLabel: { color: axLabel, fontSize: 9, interval: 'auto' as const, fontFamily: '"JetBrains Mono", monospace' },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value', min: 0, max: L.max,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: {
          color: axLabel, fontSize: 9, fontFamily: '"JetBrains Mono", monospace',
          formatter: (v: number) => type === 'pressure' ? `${v}b` : `${v}°`,
        },
        splitLine: { lineStyle: { color: gridLine, type: 'solid' as const } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: tooltipBdr,
        borderWidth: 1,
        textStyle: { color: tooltipText, fontSize: 11, fontFamily: '"JetBrains Mono", monospace' },
        axisPointer: { type: 'cross', crossStyle: { color: axLabel }, lineStyle: { color: axLabel, type: 'dashed' } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `<div style="padding:2px 4px"><span style="color:${axLabel};font-size:9px">${p.axisValue}</span><br/><b style="color:${colors.line}">${Number(p.value).toFixed(2)} ${L.unit}</b></div>`;
        },
      },
      series: [{
        type: 'line', data: [] as number[],
        smooth: 0.3, symbol: 'none', sampling: 'lttb',
        lineStyle: { color: colors.line, width: 2 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: colors.area }, { offset: 1, color: 'rgba(0,0,0,0)' }] } },
        markLine: {
          silent: true, symbol: 'none', animation: false,
          data: [
            { yAxis: ll, lineStyle: { color: critColor, type: 'dashed' as const, width: 1, opacity: 0.7 },
              label: { show: true, position: 'insideEndTop', color: critColor, fontSize: 8,
                formatter: `LL ${ll}${unit}` } },
            { yAxis: l,  lineStyle: { color: warnColor, type: 'dashed' as const, width: 1, opacity: 0.7 },
              label: { show: true, position: 'insideEndTop', color: warnColor, fontSize: 8,
                formatter: `L ${l}${unit}` } },
            { yAxis: h,  lineStyle: { color: warnColor, type: 'dashed' as const, width: 1, opacity: 0.7 },
              label: { show: true, position: 'insideEndTop', color: warnColor, fontSize: 8,
                formatter: `H ${h}${unit}` } },
            { yAxis: hh, lineStyle: { color: critColor, type: 'dashed' as const, width: 1, opacity: 0.7 },
              label: { show: true, position: 'insideEndTop', color: critColor, fontSize: 8,
                formatter: `HH ${hh}${unit}` } },
          ],
        },
      }],
    };
  }, [type, L, thresholds, unit]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, null, { renderer: 'canvas' });
    chartRef.current = chart;
    chart.setOption(buildOption(isDark));
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync chart data ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    const readings = externalReadings ?? useSensorStore.getState().readings;
    if (!readings.length) return;
    chartRef.current.setOption({
      xAxis:  { data: readings.map((r) => formatX(r.timestamp)) },
      series: [{ data: readings.map((r) => type === 'pressure' ? r.pressure : (r.temperature ?? null)) }],
    });
  }, [storeReadingCount, type, externalReadings, formatX]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.setOption(buildOption(isDark));
  }, [isDark, buildOption]);

  const headerRight = (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5 text-2xs" style={{ color: 'var(--text-3)' }}>
        <span className="inline-block w-5 h-px" style={{ background: isDark ? '#F59E0B' : '#D97706' }} /> L / H
      </span>
      <span className="flex items-center gap-1.5 text-2xs" style={{ color: 'var(--text-3)' }}>
        <span className="inline-block w-5 h-px" style={{ background: isDark ? '#EF4444' : '#DC2626' }} /> LL / HH
      </span>
      <span className="text-2xs font-mono" style={{ color: 'var(--text-3)' }}>
        {readingCount ? `${readingCount} pts` : '—'}
      </span>
    </div>
  );

  return (
    <Panel title={title} actions={headerRight} noPadding>
      <div ref={containerRef} className="w-full" style={{ height: 260 }} />
    </Panel>
  );
};
