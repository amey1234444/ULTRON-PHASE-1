import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { usePlatform } from '../../platform/PlatformContext';
import type { TauriDeviceInfo } from '../../types/tauri';

interface ManualConnectProps {
  onFound: (device: TauriDeviceInfo) => void;
}

export const ManualConnect: React.FC<ManualConnectProps> = ({ onFound }) => {
  const platform = usePlatform();
  const [host,     setHost]   = useState('');
  const [port,     setPort]   = useState('8000');
  const [status,   setStatus] = useState<'idle' | 'probing' | 'error'>('idle');
  const [errorMsg, setError]  = useState('');

  const handleConnect = async () => {
    const trimHost = host.trim().replace(/^https?:\/\//, '');
    if (!trimHost) {
      setError('Enter a hostname or IP address.');
      setStatus('error');
      return;
    }
    const baseUrl = `http://${trimHost}:${port}`;
    setStatus('probing');
    setError('');

    try {
      const device = await platform.connectDevice(baseUrl);
      onFound(device);
    } catch (err) {
      setStatus('error');
      setError(
        err instanceof Error
          ? err.message
          : `No ULTRON device found at ${baseUrl}. Check the IP address and port.`,
      );
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] tracking-widest text-c-mid uppercase font-semibold">
        Manual Connection
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="IP address or hostname"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleConnect()}
          className={cn(
            'flex-1 min-w-0 rounded-lg px-3 py-2 text-sm font-mono',
            'bg-c-raised border border-c-line text-c-bright placeholder:text-c-dim',
            'focus:outline-none focus:border-c-cyan/50 transition-colors',
          )}
        />
        <input
          type="number"
          placeholder="Port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          className={cn(
            'w-20 rounded-lg px-3 py-2 text-sm font-mono text-center',
            'bg-c-raised border border-c-line text-c-bright placeholder:text-c-dim',
            'focus:outline-none focus:border-c-cyan/50 transition-colors',
          )}
        />
        <button
          onClick={() => void handleConnect()}
          disabled={status === 'probing'}
          className={cn(
            'flex-shrink-0 rounded-lg px-4 py-2 text-sm font-semibold',
            'bg-c-cyan/10 border border-c-cyan/30 text-c-cyan',
            'hover:bg-c-cyan/20 hover:border-c-cyan/60',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'transition-all duration-150',
          )}
        >
          {status === 'probing' ? '…' : 'Connect'}
        </button>
      </div>

      {status === 'error' && (
        <p className="text-[11px] text-c-crit">{errorMsg}</p>
      )}

      <p className="text-[10px] text-c-dim leading-relaxed">
        Examples:&nbsp;
        <span className="font-mono text-c-mid">192.168.1.42</span>
        &nbsp;·&nbsp;
        <span className="font-mono text-c-mid">ultron-edge.local</span>
      </p>
    </div>
  );
};
