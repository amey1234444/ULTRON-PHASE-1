import React from 'react';
import { useToastStore } from '../../store/toastStore';
import type { ToastType } from '../../store/toastStore';

function borderFor(type: ToastType): string {
  if (type === 'critical') return 'var(--crit)';
  if (type === 'warning')  return 'var(--warn)';
  if (type === 'ok')       return 'var(--ok)';
  return 'var(--accent)';
}

export const ToastContainer: React.FC = () => {
  const toasts  = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const color = borderFor(toast.type);
        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 4,
              background: 'var(--panel)',
              border: `1px solid ${color}`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
              minWidth: 240,
              maxWidth: 400,
              pointerEvents: 'all',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              style={{
                marginLeft: 4, background: 'none', border: 'none',
                color: 'var(--text-3)', cursor: 'pointer', fontSize: 18,
                lineHeight: 1, padding: 0, flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
};
