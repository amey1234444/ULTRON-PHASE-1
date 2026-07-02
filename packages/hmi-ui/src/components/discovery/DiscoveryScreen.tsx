import React, { useState } from 'react';
import { useDeviceDiscovery } from '../../hooks/useDeviceDiscovery';
import { DeviceCard }         from './DeviceCard';
import { ManualConnect }      from './ManualConnect';
import type { TauriDeviceInfo } from '../../types/tauri';

export const DiscoveryScreen: React.FC = () => {
  const { state, progress, devices, connectTo, retry } = useDeviceDiscovery();
  const [showManual, setShowManual] = useState(false);

  const isScanning   = state === 'idle' || state === 'checking-cache' || state === 'probing';
  const isConnecting = state === 'found-single';

  const handleManualFound = (device: TauriDeviceInfo) => {
    setShowManual(false);
    connectTo(device);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'var(--surface)' }}>

      <div className="w-full max-w-sm scada-panel overflow-hidden animate-fade-in">
        <div className="h-0.5" style={{ background: 'var(--accent)' }} />
        <div className="p-8">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className={`w-14 h-14 rounded flex items-center justify-center mb-4 ${(isScanning || isConnecting) ? 'animate-status-pulse' : ''}`}
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-hi)' }}>
              <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="var(--accent)" strokeWidth={2}>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h1 className="text-lg font-black tracking-[0.2em] uppercase" style={{ color: 'var(--text)' }}>ULTRON</h1>
            <p className="text-2xs tracking-widest uppercase mt-0.5" style={{ color: 'var(--text-3)' }}>
              Device Discovery
            </p>
          </div>

          {/* Scanning */}
          {(isScanning || isConnecting) && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full animate-status-pulse"
                    style={{ background: 'var(--accent)', animationDelay: `${i * 0.25}s` }} />
                ))}
              </div>
              <p className="text-sm text-center leading-relaxed" style={{ color: 'var(--text-2)' }}>{progress}</p>
              {isScanning && (
                <div className="flex gap-4 mt-1">
                  <button onClick={() => setShowManual(true)} className="text-xs underline underline-offset-2"
                    style={{ color: 'var(--text-3)' }}>Enter IP manually</button>
                </div>
              )}
            </div>
          )}

          {/* Multiple devices */}
          {state === 'found-multiple' && (
            <div className="space-y-3">
              <p className="text-2xs tracking-widest text-center uppercase font-semibold"
                style={{ color: 'var(--text-3)' }}>
                {devices.length} devices found — select one
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {devices.map((d) => (
                  <DeviceCard key={d.api_base} device={d} onSelect={connectTo} />
                ))}
              </div>
              <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <ManualConnect onFound={handleManualFound} />
              </div>
            </div>
          )}

          {/* Not found */}
          {state === 'not-found' && !showManual && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded flex items-center justify-center"
                style={{ background: 'var(--warn-dim)', border: '1px solid var(--warn)' }}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="var(--warn)" strokeWidth={2}>
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>No device found</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-3)' }}>{progress}</p>
              </div>
              <div className="w-full space-y-2">
                <button onClick={retry} className="w-full rounded px-4 py-2.5 text-sm font-semibold transition-colors"
                  style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                  Retry Search
                </button>
                <button onClick={() => setShowManual(true)} className="w-full rounded px-4 py-2.5 text-sm font-semibold transition-colors"
                  style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                  Enter IP Address
                </button>
              </div>
            </div>
          )}

          {/* Manual entry */}
          {showManual && (
            <div className="space-y-4">
              <ManualConnect onFound={handleManualFound} />
              <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
                <button onClick={retry} className="w-full rounded px-4 py-2 text-sm font-semibold"
                  style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                  ← Auto-Search
                </button>
              </div>
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
