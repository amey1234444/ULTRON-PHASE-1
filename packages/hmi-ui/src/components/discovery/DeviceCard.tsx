import React from 'react';
import { cn } from '../../utils/cn';
import type { TauriDeviceInfo } from '../../types/tauri';

interface DeviceCardProps {
  device:   TauriDeviceInfo;
  onSelect: (device: TauriDeviceInfo) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onSelect }) => {
  const ip       = (() => { try { return new URL(device.api_base).hostname; } catch { return device.api_base; } })();
  const protocols = device.supported_protocols.join(' · ').toUpperCase();

  return (
    <button
      onClick={() => onSelect(device)}
      className={cn(
        'w-full text-left group',
        'relative rounded-xl bg-c-surface border border-c-line',
        'px-5 py-4 transition-all duration-200',
        'hover:border-c-cyan/50 hover:bg-c-raised',
        'focus:outline-none focus:ring-1 focus:ring-c-cyan/50',
      )}
    >
      <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-c-cyan/60 group-hover:bg-c-cyan transition-colors" />
      <div className="flex items-start justify-between gap-4 pl-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-c-bright truncate">{device.device_name}</p>
          <p className="mt-0.5 text-[11px] font-mono text-c-cyan">{ip}</p>
          <p className="mt-1 text-[10px] tracking-wider text-c-mid uppercase">{protocols}</p>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5 mt-0.5">
          <span className="text-[9px] tracking-widest font-bold px-2 py-0.5 rounded-full bg-c-ok/10 text-c-ok border border-c-ok/20 uppercase">
            Online
          </span>
          <span className="text-[9px] font-mono text-c-dim">v{device.software_version}</span>
        </div>
      </div>
      <div className="pl-3 mt-2 flex items-center gap-3 text-[10px] text-c-mid">
        <span>API :{device.api_port}</span>
        <span className="text-c-dim">·</span>
        <span>Modbus TCP :{device.modbus_tcp_port}</span>
      </div>
    </button>
  );
};
