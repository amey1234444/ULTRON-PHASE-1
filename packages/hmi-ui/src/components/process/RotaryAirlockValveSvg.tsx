import React from 'react';
import type { SensorPoint, SensorStatus } from './types';

// ── Layout constants ──────────────────────────────────────────────────────────

const CW = 168; // callout width
const CH = 56;  // callout height

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(s: SensorStatus): string {
  switch (s) {
    case 'normal':        return 'var(--ok)';
    case 'warning':       return 'var(--warn)';
    case 'alarm':         return 'var(--crit)';
    case 'not_installed': return 'var(--border-hi)';
  }
}

function fmtValue(s: SensorPoint): string {
  if (!s.installed || s.value === null || s.value === undefined) return '--';
  if (typeof s.value === 'number') return s.value.toFixed(s.unit === 'bar' ? 2 : 1);
  return String(s.value);
}

function rotor6Vanes(cx: number, cy: number, r0: number, r1: number) {
  return [0, 60, 120, 180, 240, 300].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x1: cx + Math.cos(rad) * r0, y1: cy + Math.sin(rad) * r0,
      x2: cx + Math.cos(rad) * r1, y2: cy + Math.sin(rad) * r1,
      cos: Math.cos(rad), sin: Math.sin(rad),
    };
  });
}

// ── Sensor callout ────────────────────────────────────────────────────────────

interface CalloutProps {
  s: SensorPoint; isSelected: boolean;
  onClick: () => void; onEnter: () => void; onLeave: () => void;
}

const SensorCallout: React.FC<CalloutProps> = ({ s, isSelected, onClick, onEnter, onLeave }) => {
  const sc  = statusColor(s.status);
  const isL = s.calloutSide === 'left';

  const leaderX = isL ? s.calloutX + CW : s.calloutX;
  const leaderY = s.calloutY + CH / 2;
  const elbowX  = isL ? s.dotX - 20 : s.dotX + 20;

  const vStr = fmtValue(s);

  return (
    <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onClick(); }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {/* Leader line */}
      <polyline
        points={`${leaderX},${leaderY} ${elbowX},${leaderY} ${s.dotX},${s.dotY}`}
        fill="none" stroke={sc} strokeWidth={s.installed ? 1.2 : 0.8} strokeDasharray="4,3"
        opacity={s.installed ? 0.8 : 0.45}
      />

      {/* Sensor dot */}
      <circle cx={s.dotX} cy={s.dotY} r={5}
        fill={sc} stroke="var(--surface)" strokeWidth={1.5}
        opacity={s.installed ? 1 : 0.5}
        style={s.status === 'alarm' ? { animation: 'critFlash 1.2s ease-in-out infinite' } : undefined}
      />
      {/* Inner ring for installed sensors */}
      {s.installed && (
        <circle cx={s.dotX} cy={s.dotY} r={2.5}
          fill="var(--surface)" opacity={0.6} />
      )}

      {/* Callout box */}
      <rect x={s.calloutX} y={s.calloutY} width={CW} height={CH} rx={2}
        fill="var(--panel-alt)"
        stroke={isSelected ? sc : (s.installed ? 'var(--border-hi)' : 'var(--border)')}
        strokeWidth={isSelected ? 1.5 : (s.installed ? 1.2 : 0.75)}
        opacity={s.installed ? 1 : 0.72}
      />
      {/* Status stripe */}
      {isL
        ? <rect x={s.calloutX} y={s.calloutY} width={3} height={CH} rx={1} fill={sc} opacity={s.installed ? 1 : 0.5} />
        : <rect x={s.calloutX + CW - 3} y={s.calloutY} width={3} height={CH} rx={1} fill={sc} opacity={s.installed ? 1 : 0.5} />
      }

      {/* Tag */}
      <text x={s.calloutX + (isL ? 9 : 8)} y={s.calloutY + 19}
        fontSize={12} fontWeight={700} letterSpacing={0.5}
        fontFamily="Inter, system-ui, sans-serif" fill={sc}
        opacity={s.installed ? 1 : 0.7}>
        {s.tag}
      </text>

      {/* Phase */}
      <text x={s.calloutX + CW - 6} y={s.calloutY + 14}
        fontSize={8.5} textAnchor="end"
        fontFamily="Inter, system-ui, sans-serif" letterSpacing={0.3}
        fill="var(--text-2)">
        {s.phase === 'phase1' ? 'P1' : s.phase === 'phase2' ? 'P2' : 'FUT'}
      </text>

      {/* Name */}
      <text x={s.calloutX + (isL ? 9 : 8)} y={s.calloutY + 34}
        fontSize={10.5} fontFamily="Inter, system-ui, sans-serif" fill="var(--text)"
        opacity={s.installed ? 0.9 : 0.6}>
        {s.name}
      </text>

      {/* Value */}
      <text x={s.calloutX + CW - (isL ? 8 : 10)} y={s.calloutY + 50}
        fontSize={s.installed ? 13 : 11} textAnchor="end" fontWeight={700}
        fontFamily="'Roboto Mono', 'JetBrains Mono', monospace"
        fill={s.installed ? sc : 'var(--text-2)'}
        opacity={s.installed ? 1 : 0.55}>
        {vStr}{s.installed && s.unit ? ` ${s.unit}` : ''}
      </text>
    </g>
  );
};

// ── Hover tooltip ─────────────────────────────────────────────────────────────

const HoverTooltip: React.FC<{ s: SensorPoint }> = ({ s }) => {
  const sc   = statusColor(s.status);
  const tx   = s.dotX > 500 ? s.dotX - 135 : s.dotX + 10;
  const ty   = s.dotY - 32;
  const vStr = fmtValue(s);
  return (
    <g pointerEvents="none">
      <rect x={tx} y={ty} width={130} height={34} rx={2}
        fill="var(--panel-alt)" stroke={sc} strokeWidth={1} opacity={0.98} />
      <text x={tx + 7} y={ty + 13} fontSize={9} fontWeight={700}
        fontFamily="Inter, system-ui, sans-serif" fill={sc}>{s.tag} · {s.name}</text>
      <text x={tx + 7} y={ty + 27} fontSize={9}
        fontFamily="'Roboto Mono', monospace" fill="var(--text-2)">
        {vStr}{s.installed && s.unit ? ` ${s.unit}` : ''}{!s.installed ? ' — Not installed' : ''}
      </text>
    </g>
  );
};

// ── Main SVG ──────────────────────────────────────────────────────────────────

interface Props {
  sensorPoints:   SensorPoint[];
  selectedTag:    string | null;
  hoveredTag:     string | null;
  isDark:         boolean;
  fillContainer?: boolean;
  onSensorClick:  (s: SensorPoint) => void;
  onSensorHover:  (tag: string | null) => void;
}

export const RotaryAirlockValveSvg: React.FC<Props> = ({
  sensorPoints, selectedTag, hoveredTag, isDark, fillContainer,
  onSensorClick, onSensorHover,
}) => {
  const cx = 420, cy = 252;
  const vanes = rotor6Vanes(cx, cy, 10, 52);
  const hovered = sensorPoints.find((s) => s.tag === hoveredTag);

  // ── Machine theme colors ────────────────────────────────────────────────────
  const machFill   = isDark ? '#132030' : '#C5D3DF';
  const machStroke = isDark ? '#3D6284' : '#6888A8';
  const boreInner  = isDark ? '#080E18' : '#E0E8F0';
  const shaftFill  = isDark ? '#1A3550' : '#9AB5CE';
  const machLabel  = isDark ? '#6EA8CC' : '#3E6585';
  const centerline = isDark ? 'rgba(61,98,132,0.45)' : 'rgba(104,136,168,0.35)';
  const flowArrow  = isDark ? '#3D6284' : '#7898B8';
  const flangeStroke = isDark ? '#4A7098' : '#8AACC8';

  const p1  = sensorPoints.find((s) => s.tag === 'P1');
  const p2  = sensorPoints.find((s) => s.tag === 'P2');
  const hasDP = p1?.installed && p2?.installed && p1.value !== null && p2.value !== null;
  const dpVal = hasDP
    ? `ΔP  ${((p1!.value as number) - (p2!.value as number)).toFixed(2)} bar`
    : 'ΔP  —';

  return (
    <svg
      viewBox="0 0 900 560"
      width="100%"
      height={fillContainer ? '100%' : undefined}
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: 'block',
        // When filling the container, use absolute positioning so the SVG
        // occupies the full bounded parent regardless of CSS percentage quirks
        ...(fillContainer ? { position: 'absolute', inset: 0, width: '100%', height: '100%' } : {}),
      }}
      aria-label="Rotary Airlock Valve RAV-01 Process Diagram"
    >

      {/* ── INLET DUCT ──────────────────────────────────────────────────────── */}
      {/* Top flange — centered at cx=420 */}
      <rect x={350} y={22} width={140} height={11} rx={2}
        fill={machFill} stroke={flangeStroke} strokeWidth={2} />
      {[370, 390, 410, 430, 450, 470].map((bx) => (
        <circle key={bx} cx={bx} cy={27.5} r={3}
          fill={boreInner} stroke={machStroke} strokeWidth={1} />
      ))}
      {/* Duct pipe walls */}
      <rect x={372} y={33} width={10} height={141} fill={machFill} stroke={machStroke} strokeWidth={1.5} />
      <rect x={458} y={33} width={10} height={141} fill={machFill} stroke={machStroke} strokeWidth={1.5} />
      {/* Duct inner channel */}
      <rect x={382} y={33} width={76} height={141} fill={boreInner} />
      {/* Inlet label */}
      <text x={420} y={15} textAnchor="middle" fontSize={9} fontWeight={600}
        letterSpacing={2} fontFamily="Inter, system-ui, sans-serif" fill={machLabel}>
        INLET / HOPPER
      </text>

      {/* Flow arrow — inlet */}
      <polygon points={`420,125 412,108 428,108`} fill={flowArrow} opacity={0.8} />
      <line x1={420} y1={108} x2={420} y2={155} stroke={flowArrow}
        strokeWidth={1.5} strokeDasharray="5,4" opacity={0.6} />

      {/* ── VALVE BODY ──────────────────────────────────────────────────────── */}
      {/* Left side wall */}
      <rect x={324} y={174} width={14} height={156} fill={machFill} stroke={machStroke} strokeWidth={2} />
      {/* Right side wall */}
      <rect x={502} y={174} width={14} height={156} fill={machFill} stroke={machStroke} strokeWidth={2} />
      {/* Top cap left */}
      <rect x={324} y={174} width={48} height={14} fill={machFill} stroke={machStroke} strokeWidth={2} />
      {/* Top cap right */}
      <rect x={468} y={174} width={48} height={14} fill={machFill} stroke={machStroke} strokeWidth={2} />
      {/* Bottom cap left */}
      <rect x={324} y={316} width={48} height={14} fill={machFill} stroke={machStroke} strokeWidth={2} />
      {/* Bottom cap right */}
      <rect x={468} y={316} width={48} height={14} fill={machFill} stroke={machStroke} strokeWidth={2} />
      {/* Body inner fill */}
      <rect x={338} y={188} width={164} height={128} fill={boreInner} />

      {/* ── ROTOR BORE ──────────────────────────────────────────────────────── */}
      <circle cx={cx} cy={cy} r={61} fill={boreInner} stroke={machStroke} strokeWidth={1.5} />
      {/* Bore hatch marks */}
      {[-40, -20, 0, 20, 40].map((off) => (
        <React.Fragment key={off}>
          <line x1={cx + off} y1={cy - 61} x2={cx + off} y2={cy - 54}
            stroke={machStroke} strokeWidth={0.8} opacity={0.5} />
          <line x1={cx + off} y1={cy + 54} x2={cx + off} y2={cy + 61}
            stroke={machStroke} strokeWidth={0.8} opacity={0.5} />
        </React.Fragment>
      ))}

      {/* ── ROTOR ───────────────────────────────────────────────────────────── */}
      {/* Shaft centerline */}
      <line x1={258} y1={cy} x2={726} y2={cy}
        stroke={centerline} strokeWidth={1} strokeDasharray="7,4} " />

      {/* 6 vanes */}
      {vanes.map((v, i) => (
        <line key={i} x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}
          stroke={machStroke} strokeWidth={3} strokeLinecap="round" />
      ))}
      {/* Vane tip seal strips */}
      {vanes.map((v, i) => {
        const px = -v.sin * 4, py = v.cos * 4;
        return (
          <line key={`t${i}`}
            x1={v.x2 - px} y1={v.y2 - py} x2={v.x2 + px} y2={v.y2 + py}
            stroke={isDark ? '#5A82A8' : '#6080A0'} strokeWidth={2.5} strokeLinecap="round" />
        );
      })}
      {/* Rotor hub */}
      <circle cx={cx} cy={cy} r={11}
        fill={machFill} stroke={machStroke} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={4}
        fill={machStroke} />

      {/* Body label */}
      <text x={cx} y={cy + 86} textAnchor="middle" fontSize={8.5}
        fontWeight={600} letterSpacing={1.5}
        fontFamily="Inter, system-ui, sans-serif" fill={machLabel}>
        ROTOR CHAMBER
      </text>

      {/* RAV-01 ID tag */}
      <text x={cx} y={172} textAnchor="middle" fontSize={9} fontWeight={700}
        letterSpacing={1.5} fontFamily="Inter, system-ui, sans-serif" fill="var(--text-2)">
        RAV-01
      </text>

      {/* ── OUTLET DUCT ─────────────────────────────────────────────────────── */}
      <rect x={372} y={330} width={10} height={141} fill={machFill} stroke={machStroke} strokeWidth={1.5} />
      <rect x={458} y={330} width={10} height={141} fill={machFill} stroke={machStroke} strokeWidth={1.5} />
      <rect x={382} y={330} width={76} height={141} fill={boreInner} />
      {/* Bottom flange — centered at cx=420 */}
      <rect x={350} y={471} width={140} height={11} rx={2}
        fill={machFill} stroke={flangeStroke} strokeWidth={2} />
      {[370, 390, 410, 430, 450, 470].map((bx) => (
        <circle key={bx} cx={bx} cy={476.5} r={3}
          fill={boreInner} stroke={machStroke} strokeWidth={1} />
      ))}
      <text x={420} y={498} textAnchor="middle" fontSize={9} fontWeight={600}
        letterSpacing={2} fontFamily="Inter, system-ui, sans-serif" fill={machLabel}>
        DISCHARGE
      </text>

      {/* Flow arrow — outlet */}
      <polygon points={`420,420 412,403 428,403`} fill={flowArrow} opacity={0.8} />
      <line x1={420} y1={403} x2={420} y2={450} stroke={flowArrow}
        strokeWidth={1.5} strokeDasharray="5,4" opacity={0.6} />

      {/* ── DRIVE ASSEMBLY (RIGHT) ───────────────────────────────────────────── */}
      {/* DS shaft to coupling */}
      <rect x={516} y={cy - 4} width={42} height={8} rx={2}
        fill={shaftFill} stroke={machStroke} strokeWidth={1} />
      {/* DS bearing housing */}
      <rect x={514} y={242} width={16} height={20} rx={1}
        fill={machFill} stroke={machStroke} strokeWidth={1.5} />
      <text x={522} y={cy + 26} textAnchor="middle" fontSize={6.5}
        fontFamily="Inter, system-ui, sans-serif" fill={machLabel}>DS BRG</text>

      {/* Coupling */}
      <rect x={558} y={244} width={24} height={16} rx={2}
        fill={machFill} stroke={machStroke} strokeWidth={1.5} />
      <line x1={558} y1={cy} x2={582} y2={cy} stroke={machStroke} strokeWidth={0.75} strokeDasharray="2,2" />
      <text x={570} y={cy + 26} textAnchor="middle" fontSize={6.5}
        fontFamily="Inter, system-ui, sans-serif" fill={machLabel}>CPNG</text>

      {/* Gearbox */}
      <rect x={582} y={218} width={64} height={68} rx={2}
        fill={machFill} stroke={machStroke} strokeWidth={1.5} />
      <text x={614} y={249} textAnchor="middle" fontSize={8.5} fontWeight={600}
        letterSpacing={0.5} fontFamily="Inter, system-ui, sans-serif" fill={machLabel}>GBX</text>
      <text x={614} y={262} textAnchor="middle" fontSize={8}
        fontFamily="Inter, system-ui, sans-serif" fill={machLabel}>⚙</text>

      {/* Motor */}
      <rect x={646} y={220} width={62} height={64} rx={2}
        fill={machFill} stroke={machStroke} strokeWidth={1.5} />
      <text x={677} y={249} textAnchor="middle" fontSize={8.5} fontWeight={600}
        letterSpacing={0.5} fontFamily="Inter, system-ui, sans-serif" fill={machLabel}>MOTOR</text>
      <text x={677} y={262} textAnchor="middle" fontSize={7.5}
        fontFamily="Inter, system-ui, sans-serif" fill={machLabel}>3φ AC</text>
      {/* Fan guard */}
      <rect x={708} y={226} width={12} height={52} rx={2}
        fill={machFill} stroke={machStroke} strokeWidth={1} />
      {[232, 240, 248, 256, 264, 270].map((fy) => (
        <line key={fy} x1={709} y1={fy} x2={719} y2={fy}
          stroke={machStroke} strokeWidth={0.75} />
      ))}

      {/* ── NDS ASSEMBLY (LEFT) ──────────────────────────────────────────────── */}
      {/* NDS shaft stub */}
      <rect x={282} y={cy - 4} width={42} height={8} rx={2}
        fill={shaftFill} stroke={machStroke} strokeWidth={1} />
      {/* NDS bearing housing */}
      <rect x={274} y={242} width={16} height={20} rx={1}
        fill={machFill} stroke={machStroke} strokeWidth={1.5} />
      <text x={282} y={cy + 26} textAnchor="middle" fontSize={6.5}
        fontFamily="Inter, system-ui, sans-serif" fill={machLabel}>NDS BRG</text>
      {/* NDS end plate */}
      <rect x={258} y={240} width={16} height={24} rx={1}
        fill={machFill} stroke={machStroke} strokeWidth={1.5} />

      {/* ── ΔP BADGE — above MT2, L-shaped connector, no line collisions ───── */}
      {/* Horizontal leg: badge right-edge → spine (y=362 is clear gap between V2 and MT2) */}
      <line x1={176} y1={362} x2={316} y2={362}
        stroke={hasDP ? 'var(--ok)' : machStroke}
        strokeWidth={1} strokeDasharray="4,3" opacity={0.75} />
      {/* Vertical spine: runs from junction up through both tap points */}
      <line x1={316} y1={194} x2={316} y2={362}
        stroke={hasDP ? 'var(--ok)' : machStroke}
        strokeWidth={1} strokeDasharray="4,3" opacity={0.75} />
      {/* Upper tap branch → valve body wall */}
      <line x1={316} y1={194} x2={324} y2={194}
        stroke={hasDP ? 'var(--ok)' : machStroke} strokeWidth={1} opacity={0.8} />
      {/* Lower tap branch → valve body wall */}
      <line x1={316} y1={312} x2={324} y2={312}
        stroke={hasDP ? 'var(--ok)' : machStroke} strokeWidth={1} opacity={0.8} />
      {/* Tap point markers on valve wall */}
      <circle cx={325} cy={194} r={3}
        fill={hasDP ? 'var(--ok)' : machStroke} opacity={0.85} />
      <circle cx={325} cy={312} r={3}
        fill={hasDP ? 'var(--ok)' : machStroke} opacity={0.85} />
      {/* Badge — aligned with left callout column, above MT2 */}
      <rect x={8} y={348} width={168} height={28} rx={3}
        fill={boreInner} stroke={hasDP ? 'var(--ok)' : 'var(--border)'}
        strokeWidth={hasDP ? 1.2 : 0.75} />
      <rect x={8} y={349} width={4} height={26} rx={1.5}
        fill={hasDP ? 'var(--ok)' : 'var(--border-hi)'} />
      <text x={94} y={367} textAnchor="middle"
        fontSize={9} fontFamily="'Roboto Mono', 'JetBrains Mono', monospace"
        fontWeight={700} fill={hasDP ? 'var(--ok)' : 'var(--text-3)'}>
        {dpVal}
      </text>

      {/* ── SENSOR CALLOUTS ──────────────────────────────────────────────────── */}
      {sensorPoints.map((s) => (
        <SensorCallout key={s.tag} s={s}
          isSelected={s.tag === selectedTag}
          onClick={() => onSensorClick(s)}
          onEnter={() => onSensorHover(s.tag)}
          onLeave={() => onSensorHover(null)}
        />
      ))}

      {/* ── HOVER TOOLTIP ────────────────────────────────────────────────────── */}
      {hovered && <HoverTooltip s={hovered} />}
    </svg>
  );
};
