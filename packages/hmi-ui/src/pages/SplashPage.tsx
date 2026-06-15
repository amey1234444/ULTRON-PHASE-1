import React, { useEffect, useRef, useState } from 'react';
import { useAppStore }               from '../store/appStore';
import { useConnectionStore, deviceInfoToConfig } from '../store/connectionStore';
import { usePlatform } from '../platform/PlatformContext';
import type { TauriDeviceInfo } from '../types/tauri';

type StartupPhase = 'init' | 'loading-settings' | 'starting-backend' | 'backend-ok' | 'discovering' | 'found' | 'not-found' | 'error';

const MESSAGES: Record<StartupPhase, string> = {
  'init':              'Initializing ULTRON…',
  'loading-settings':  'Loading saved settings…',
  'starting-backend':  'Starting backend service…',
  'backend-ok':        'Backend ready.',
  'discovering':       'Searching for ULTRON Edge on local network…',
  'found':             'Device found — opening dashboard…',
  'not-found':         'No device found on this network.',
  'error':             'Startup error.',
};

export const SplashPage: React.FC = () => {
  const platform = usePlatform();
  const [phase,        setPhase]        = useState<StartupPhase>('init');
  const [message,      setMessage]      = useState(MESSAGES['init']);
  const [log,          setLog]          = useState<string[]>([]);
  const [backendError, setBackendError] = useState<string | null>(null);

  const setAppPhase      = useAppStore((s) => s.setAppPhase);
  const setBackendRunning = useAppStore((s) => s.setBackendRunning);
  const setAppVersion    = useAppStore((s) => s.setAppVersion);
  const setConfig        = useConnectionStore((s) => s.setConfig);
  const enterSim         = useConnectionStore((s) => s.enterSimulation);

  const unlistenRef = useRef<(() => void) | null>(null);
  const didRun      = useRef(false);

  const pushLog = (msg: string) => setLog((prev) => [...prev.slice(-7), msg]);
  const advance = (p: StartupPhase, msg?: string) => {
    setPhase(p);
    const txt = msg ?? MESSAGES[p];
    setMessage(txt);
    pushLog(txt);
  };

  const goSimulation = () => {
    platform.startSimulation().catch(() => {});
    enterSim();
    setAppPhase('simulation');
  };
  const goDiscovery = () => setAppPhase('discovery');

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const run = async () => {
      try { const ver = await platform.getAppVersion(); setAppVersion(ver); } catch {}

      advance('loading-settings');
      let lastIp: string | null = null;
      try { const s = await platform.getSavedSettings(); lastIp = s.last_device_ip; } catch {}

      advance('starting-backend');
      try {
        const status = await platform.startBackend();
        setBackendRunning(status.health_ok);
        advance('backend-ok', status.external ? 'Backend already running (external).' : MESSAGES['backend-ok']);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setBackendError(msg);
        pushLog(`Backend warning: ${msg}`);
      }

      if (platform.onDiscoveryProgress) {
        unlistenRef.current = await platform.onDiscoveryProgress((e) => {
          pushLog(e.message);
          setMessage(e.message);
        });
      }

      advance('discovering');
      let found: TauriDeviceInfo[] = [];
      try { found = await platform.discoverDevices(lastIp ?? undefined); }
      catch (err) { pushLog(`Discovery error: ${err instanceof Error ? err.message : String(err)}`); }

      if (unlistenRef.current) { unlistenRef.current(); unlistenRef.current = null; }

      if (found.length > 0) {
        const device = found[0];
        advance('found', `Connected to ${device.device_name} at ${device.api_base}`);
        const cfg = deviceInfoToConfig(device);
        setConfig(cfg);
        platform.saveSettings({ last_device_ip: cfg.deviceIp }).catch(() => {});

        // Request hardware mode automatically — fire-and-forget.
        // If the Pi's sensors are not yet wired, the backend stays in simulation
        // mode and returns success:false, which is handled gracefully.
        fetch(`${device.api_base}/api/control/mode`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ simulated: false }),
        }).catch(() => {});

        await new Promise<void>((r) => setTimeout(r, 700));
        setAppPhase(found.length > 1 ? 'discovery' : 'connected');
        return;
      }

      advance('not-found');
    };

    run().catch((err) => {
      setPhase('error');
      setMessage(`Startup failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    return () => { if (unlistenRef.current) { unlistenRef.current(); unlistenRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  const isSearching = ['discovering', 'starting-backend', 'loading-settings'].includes(phase);
  const isFound     = phase === 'found';
  const isNotFound  = phase === 'not-found' || phase === 'error';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'var(--surface)' }}>

      <div className="w-full max-w-sm scada-panel p-0 overflow-hidden animate-fade-in"
        style={{ boxShadow: '0 8px 48px rgba(0,0,0,0.5), 0 0 80px rgba(56,160,255,0.04)' }}>
        {/* Header accent bar */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%)' }} />

        <div className="p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-lg flex items-center justify-center mb-4"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-hi)', boxShadow: '0 0 24px rgba(56,160,255,0.12)' }}>
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none"
                stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h1 className="text-xl font-black tracking-[0.3em] uppercase" style={{ color: 'var(--text)' }}>
              ULTRON
            </h1>
            <p className="text-2xs tracking-widest uppercase mt-1" style={{ color: 'var(--text-3)' }}>
              Industrial Control System
            </p>
          </div>

          {/* Status */}
          {!isNotFound && (
            <div className="flex flex-col items-center gap-4 mb-6">
              {isSearching && (
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full animate-status-pulse"
                      style={{ background: 'var(--accent)', animationDelay: `${i * 0.25}s` }} />
                  ))}
                </div>
              )}
              {isFound && <span className="text-lg font-bold" style={{ color: 'var(--ok)' }}>✓</span>}
              <p className="text-sm text-center leading-relaxed" style={{ color: 'var(--text-2)' }}>{message}</p>
            </div>
          )}

          {/* Log */}
          {log.length > 0 && (
            <div className="mb-5 rounded p-2.5 max-h-28 overflow-y-auto text-2xs font-mono space-y-0.5"
              style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
              {log.map((line, i) => (
                <div key={i} style={{ color: 'var(--text-3)' }}>
                  <span style={{ color: 'var(--border-hi)' }}>› </span>{line}
                </div>
              ))}
            </div>
          )}

          {/* Not-found actions */}
          {isNotFound && (
            <div className="flex flex-col gap-2.5">
              <p className="text-sm text-center mb-1" style={{ color: 'var(--text-2)' }}>{message}</p>
              {backendError && (
                <div className="rounded p-2 text-2xs"
                  style={{ background: 'var(--warn-dim)', border: '1px solid var(--warn)', color: 'var(--warn)' }}>
                  Backend: {backendError}
                </div>
              )}
              <button onClick={goDiscovery} className="btn-primary w-full">
                Search Again / Enter IP
              </button>
              <button onClick={goSimulation} className="btn-secondary w-full">
                Continue in Simulation Mode
              </button>
            </div>
          )}

          {/* Skip during search */}
          {isSearching && (
            <div className="flex justify-center mt-4">
              <button onClick={goSimulation} className="text-xs transition-colors underline underline-offset-2"
                style={{ color: 'var(--text-3)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}>
                Skip — use simulation
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-5 text-2xs tracking-widest uppercase" style={{ color: 'var(--text-3)' }}>
        Oswar Software · ULTRON Phase 1 Demo
      </p>
    </div>
  );
};
