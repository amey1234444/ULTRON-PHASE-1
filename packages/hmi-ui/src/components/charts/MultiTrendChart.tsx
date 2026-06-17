import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { Panel }             from '../ui/Panel';
import { useSensorStore }    from '../../store/sensorStore';
import { useThresholdStore } from '../../store/thresholdStore';
import type { SensorThresholds } from '../../store/thresholdStore';
import { useTheme }          from '../../context/ThemeContext';
import { LIMITS } from '../../config/constants';
import { formatTimestamp }   from '../../utils/formatters';
import type { SensorType }   from '../../config/constants';
import type { SensorReading } from '../../types/sensor';

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  dark: {
    pressure:    { line: '#38A0FF', area: 'rgba(56,160,255,0.14)'  },
    temperature: { line: '#FFB020', area: 'rgba(255,176,32,0.14)'  },
  },
  light: {
    pressure:    { line: '#1E80F0', area: 'rgba(30,128,240,0.10)'  },
    temperature: { line: '#D08000', area: 'rgba(208,128,0,0.10)'   },
  },
} as const;

// ── X-axis formatters ─────────────────────────────────────────────────────────

function formatHistTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    });
  } catch { return '--'; }
}

// ── Build full ECharts option ─────────────────────────────────────────────────

function buildOption(
  dark:       boolean,
  actP:       boolean,
  actT:       boolean,
  pThresh:    SensorThresholds,
  tThresh:    SensorThresholds,
  historical: boolean,
): EChartsOption {
  const c    = dark ? C.dark : C.light;
  const Lp   = LIMITS.pressure;
  const Lt   = LIMITS.temperature;
  const both = actP && actT;

  const gridLine   = dark ? 'rgba(26,48,72,0.9)' : 'rgba(216,226,238,1)';
  const axLabel    = dark ? '#6AAED0' : '#4A6880';
  const tooltipBg  = dark ? '#0C1A28' : '#FFFFFF';
  const tooltipBdr = dark ? '#1A3048' : '#D8E2EE';
  const warnColor  = dark ? '#FFB020' : '#D08000';
  const critColor  = dark ? '#FF4040' : '#D42020';

  const gradFill = (color: string) => ({
    type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [{ offset: 0, color }, { offset: 1, color: 'rgba(0,0,0,0)' }],
  });

  const makeMarkLines = (t: SensorThresholds, unitSuffix: string) => ({
    silent: true, symbol: 'none', animation: false,
    data: [
      { yAxis: t.ll, lineStyle: { color: critColor, type: 'dashed' as const, width: 1, opacity: 0.7 },
        label: { show: true, position: 'insideEndTop' as const, color: critColor, fontSize: 7, formatter: `LL ${t.ll}${unitSuffix}` } },
      { yAxis: t.l,  lineStyle: { color: warnColor, type: 'dashed' as const, width: 1, opacity: 0.7 },
        label: { show: true, position: 'insideEndTop' as const, color: warnColor, fontSize: 7, formatter: `L ${t.l}${unitSuffix}` } },
      { yAxis: t.h,  lineStyle: { color: warnColor, type: 'dashed' as const, width: 1, opacity: 0.7 },
        label: { show: true, position: 'insideEndTop' as const, color: warnColor, fontSize: 7, formatter: `H ${t.h}${unitSuffix}` } },
      { yAxis: t.hh, lineStyle: { color: critColor, type: 'dashed' as const, width: 1, opacity: 0.7 },
        label: { show: true, position: 'insideEndTop' as const, color: critColor, fontSize: 7, formatter: `HH ${t.hh}${unitSuffix}` } },
    ],
  });

  const zoomStart = historical ? 0 : 70;

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: { top: 20, right: both ? 58 : 12, bottom: 42, left: 54, containLabel: false },
    dataZoom: [
      { type: 'inside', start: zoomStart, end: 100, zoomOnMouseWheel: true, moveOnMouseMove: true },
      {
        type: 'slider', start: zoomStart, end: 100, height: 16, bottom: 4,
        borderColor:     dark ? '#1A3048' : '#B8CCDF',
        backgroundColor: dark ? '#060C18' : '#EDF1F7',
        fillerColor:     dark ? 'rgba(56,160,255,0.14)' : 'rgba(30,128,240,0.10)',
        handleStyle:     { color: dark ? '#38A0FF' : '#1E80F0' },
        textStyle:       { color: axLabel, fontSize: 9 },
      },
    ],
    xAxis: {
      type: 'category', data: [] as string[], boundaryGap: false,
      axisLine: { lineStyle: { color: gridLine } },
      axisTick: { show: false },
      axisLabel: { color: axLabel, fontSize: 10, interval: 'auto' as const, fontFamily: '"JetBrains Mono", monospace' },
      splitLine: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: actP ? Lp.max : Lt.max,
        position: 'left',
        axisLine:  { show: false },
        axisTick:  { show: false },
        axisLabel: {
          color: actP ? c.pressure.line : c.temperature.line,
          fontSize: 10, fontFamily: '"JetBrains Mono", monospace',
          formatter: (v: number) => actP ? `${v}b` : `${v}°`,
        },
        splitLine: { lineStyle: { color: gridLine, type: 'solid' as const } },
      },
      {
        type: 'value', show: both,
        min: 0, max: Lt.max,
        position: 'right',
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: {
          color: c.temperature.line, fontSize: 10,
          fontFamily: '"JetBrains Mono", monospace',
          formatter: (v: number) => `${v}°`,
        },
        splitLine: { show: false },
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg, borderColor: tooltipBdr, borderWidth: 1,
      textStyle: { fontSize: 11, fontFamily: '"JetBrains Mono", monospace' },
      axisPointer: { type: 'cross' as const, lineStyle: { color: axLabel, type: 'dashed' as const } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const list = (Array.isArray(params) ? params : [params]).filter(
          (p: any) => p.data !== undefined && p.data !== null,
        );
        if (!list.length) return '';
        const time = list[0].axisValue ?? '';
        const lines = list.map((p: any) => {
          const isPres = p.seriesName === 'Pressure';
          const col  = isPres ? c.pressure.line : c.temperature.line;
          const unit = isPres ? ' bar' : ' °C';
          return `<span style="color:${col};font-weight:700">${p.seriesName}: ${Number(p.value).toFixed(2)}${unit}</span>`;
        }).join('<br/>');
        return `<div style="padding:3px 6px"><span style="font-size:8px;color:${axLabel}">${time}</span><br/>${lines}</div>`;
      },
    },
    series: [
      {
        id: 'pressure', name: 'Pressure', type: 'line', yAxisIndex: 0,
        data: [] as number[], smooth: 0.3, symbol: 'none', sampling: 'lttb',
        lineStyle: { color: c.pressure.line, width: 1.8, opacity: actP ? 1 : 0 },
        areaStyle: actP ? { color: gradFill(c.pressure.area) } : undefined,
        markLine:  actP ? makeMarkLines(pThresh, 'b') : { data: [] },
      },
      {
        id: 'temperature', name: 'Temperature', type: 'line', yAxisIndex: both ? 1 : 0,
        data: [] as number[], smooth: 0.3, symbol: 'none', sampling: 'lttb',
        lineStyle: { color: c.temperature.line, width: 1.8, opacity: actT ? 1 : 0 },
        areaStyle: actT ? { color: gradFill(c.temperature.area) } : undefined,
        markLine:  actT ? makeMarkLines(tThresh, '°') : { data: [] },
      },
    ],
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface MultiTrendChartProps {
  /** When provided, display this data instead of the live store. */
  readings?: SensorReading[];
  /** Use full date+time labels and show full range on x-axis (historical mode). */
  historical?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const MultiTrendChart: React.FC<MultiTrendChartProps> = ({
  readings: externalReadings,
  historical = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<echarts.ECharts | null>(null);
  const { theme }    = useTheme();
  const isDark       = theme === 'dark';

  const storeReadingCount = useSensorStore((s) =>
    externalReadings !== undefined ? 0 : s.readings.length,
  );

  const pThresh = useThresholdStore((s) => s.pressure);
  const tThresh = useThresholdStore((s) => s.temperature);

  const [active, setActive] = useState<Set<SensorType>>(
    () => new Set<SensorType>(['pressure', 'temperature']),
  );

  const readingCount = externalReadings?.length ?? storeReadingCount;
  const formatX      = historical ? formatHistTs : formatTimestamp;

  function toggle(type: SensorType) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(type) && next.size > 1) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, null, { renderer: 'canvas' });
    chartRef.current = chart;

    const { pressure: initP, temperature: initT } = useThresholdStore.getState();
    chart.setOption(buildOption(isDark, true, true, initP, initT, historical));

    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync data ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    const readings = externalReadings ?? useSensorStore.getState().readings;
    if (!readings.length) return;
    chartRef.current.setOption({
      xAxis: { data: readings.map((r) => formatX(r.timestamp)) },
      series: [
        { id: 'pressure',    data: active.has('pressure')    ? readings.map((r) => r.pressure)            : [] },
        { id: 'temperature', data: active.has('temperature') ? readings.map((r) => r.temperature ?? null) : [] },
      ],
    });
  }, [storeReadingCount, active, externalReadings, formatX]);

  // ── Rebuild on theme / active / thresholds / mode ────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.setOption(
      buildOption(isDark, active.has('pressure'), active.has('temperature'), pThresh, tThresh, historical),
      { notMerge: true },
    );
  }, [isDark, active, pThresh, tThresh, historical]);

  // ── Header ────────────────────────────────────────────────────────────────────
  const c = isDark ? C.dark : C.light;

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {(['pressure', 'temperature'] as SensorType[]).map((type) => {
        const on    = active.has(type);
        const color = type === 'pressure' ? c.pressure.line : c.temperature.line;
        const label = type === 'pressure' ? 'Pressure' : 'Temperature';
        const unit  = type === 'pressure' ? 'bar'      : '°C';
        return (
          <button
            key={type}
            onClick={() => toggle(type)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 2, cursor: 'pointer',
              border: `1px solid ${on ? color : 'var(--border)'}`,
              background: on ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
              transition: 'all 140ms ease',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? color : 'var(--border-hi)', flexShrink: 0 }} />
            <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.04em', color: on ? color : 'var(--text-3)', fontFamily: 'Inter, system-ui, sans-serif' }}>
              {label} ({unit})
            </span>
          </button>
        );
      })}
      <span style={{ fontSize: 8, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-3)' }}>
        {readingCount ? `${readingCount} pts` : '—'}
      </span>
    </div>
  );

  const title = historical ? 'HISTORICAL TRENDS' : 'LIVE TRENDS';

  return (
    <Panel title={title} actions={headerRight} noPadding className="h-full" bodyClass="flex flex-col min-h-0">
      <div ref={containerRef} style={{ width: '100%', flex: 1, minHeight: 220 }} />
    </Panel>
  );
};
