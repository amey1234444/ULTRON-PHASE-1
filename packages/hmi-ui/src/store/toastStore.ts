import { create } from 'zustand';

export type ToastType = 'ok' | 'warning' | 'critical' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string, type?: ToastType) => void;
  dismiss: (id: number) => void;
}

let _nextId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  push: (message, type = 'info') => {
    const id = ++_nextId;
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
