import React from 'react';
import { useSensorStore }   from '../store/sensorStore';
import { useDeviceInfo }    from '../hooks/useDeviceInfo';
import { useAppStore }      from '../store/appStore';
import { getHealthColor, getHealthStatus } from '../utils/formatters';
import { ConnectionBadge }  from './ui/StatusBadge';
import { ClockDisplay }     from './ui/ClockDisplay';
import { cn }               from '../utils/cn';

const BoltIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
    className={className} strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const Logo: React.FC = () => (
  <div className="flex items-center gap-3.5 shrink-0">
    <div className="relative w-10 h-10 flex items-center justify-center">
      <div
        className="absolute inset-0 border border-c-cyan/25 bg-c-cyan/8"
        style={{ clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)' }}
      />
      <div
        className="absolute inset-1 bg-c-cyan/5"
        style={{ clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)' }}
      />
      <BoltIcon className="w-4 h-4 text-c-cyan relative z-10" />
    </div>
    <div className="leading-none">
      <div className="text-c-bright font-black tracking-[0.32em] text-base">ULTRON</div>
      <div className="text-c-mid text-[8px] tracking-[0.4em] mt-0.5 font-medium">
        INDUSTRIAL CONTROL
      </div>
    </div>
  </div>
);

const HealthPill: React.FC = () => {
  const score  = useSensorStore((s) => s.healthScore);
  const color  = getHealthColor(score);
  const status = getHealthStatus(score);
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border"
      style={{ borderColor: `${color}30`, background: `${color}08` }}>
      <span className="relative flex h-1.5 w-1.5">
        {status !== 'healthy' && (
          <span className="absolute inset-0 rounded-full animate-pulse-slow"
            style={{ background: color, opacity: 0.6 }} />
        )}
        <span className="relative inline-flex rounded-full h-1.5 w-1.5"
          style={{ background: color }} />
      </span>
      <span className="text-[9px] font-bold tracking-[0.2em]" style={{ color }}>HEALTH</span>
      <span className="text-[13px] font-black font-mono tabular" style={{ color }}>{score}%</span>
    </div>
  );
};

const AlarmsCounter: React.FC = () => {
  const alarms = useSensorStore((s) => s.alarms);
  const count  = Object.values(alarms).filter(Boolean).length;
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-bold tracking-[0.2em]',
      count > 0
        ? 'border-c-crit/30 bg-c-crit/8 text-c-crit alarm-flash'
        : 'border-c-line bg-c-dim/20 text-c-mid',
    )}>
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
      </svg>
      {count > 0 ? `${count} ALARM${count > 1 ? 'S' : ''}` : 'NO ALARMS'}
    </div>
  );
};

const Divider: React.FC = () => (
  <div className="hidden md:block w-px h-7 bg-c-line" />
);

interface HeaderProps {
  onSettings?:    () => void;
  onDiagnostics?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSettings, onDiagnostics }) => {
  const connectionStatus = useSensorStore((s) => s.connectionStatus);
  const { data: device } = useDeviceInfo();
  const appPhase         = useAppStore((s) => s.appPhase);

  return (
    <header className="sticky top-0 z-50 bg-c-deep/90 backdrop-blur-lg border-b border-c-line">
      <div className="h-[2px] header-beam opacity-70" />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-5">
        <Logo />
        <Divider />

        {/* Center */}
        <div className="flex-1 flex items-center gap-3 sm:gap-4 overflow-hidden">
          <HealthPill />

          {/* Simulation banner */}
          {appPhase === 'simulation' && (
            <>
              <Divider />
              <span className="text-[9px] font-bold tracking-[0.25em] text-c-warn bg-c-warn/10 px-2 py-1 rounded-full border border-c-warn/30">
                SIMULATION
              </span>
            </>
          )}

          {device && (
            <>
              <Divider />
              <div className="hidden lg:flex items-center gap-1.5 text-[9px]">
                <span className="text-c-mid tracking-widest">DEVICE</span>
                <span className="text-c-bright font-mono font-semibold">{device.device_id}</span>
              </div>
              <Divider />
              <div className="hidden lg:flex items-center gap-1.5 text-[9px]">
                <span className="text-c-mid tracking-widest">MODE</span>
                <span className={cn('font-bold tracking-[0.18em]',
                  device.mode === 'simulated' ? 'text-c-warn' : 'text-c-ok')}>
                  {device.mode.toUpperCase()}
                </span>
              </div>
              <Divider />
              <div className="hidden xl:flex items-center gap-1.5 text-[9px]">
                <span className="text-c-mid tracking-widest">VER</span>
                <span className="text-c-bright font-mono">v{device.version}</span>
              </div>
            </>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <AlarmsCounter />
          <Divider />
          <ClockDisplay />
          <Divider />
          <ConnectionBadge status={connectionStatus} />

          {/* Settings / Diagnostics buttons */}
          {(onSettings || onDiagnostics) && (
            <>
              <Divider />
              <div className="flex items-center gap-2">
                {onDiagnostics && (
                  <button
                    onClick={onDiagnostics}
                    title="Diagnostics"
                    className="w-7 h-7 flex items-center justify-center rounded text-c-dim hover:text-c-cyan transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </button>
                )}
                {onSettings && (
                  <button
                    onClick={onSettings}
                    title="Settings"
                    className="w-7 h-7 flex items-center justify-center rounded text-c-dim hover:text-c-cyan transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx={12} cy={12} r={3} />
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
