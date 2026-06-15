/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../packages/hmi-ui/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* Semantic tokens resolved from CSS custom properties */
        surface:      'var(--surface)',
        panel:        'var(--panel)',
        'panel-alt':  'var(--panel-alt)',
        border:       'var(--border)',
        'border-hi':  'var(--border-hi)',
        text:         'var(--text)',
        'text-2':     'var(--text-2)',
        'text-3':     'var(--text-3)',
        accent:       'var(--accent)',
        'accent-dim': 'var(--accent-dim)',
        ok:           'var(--ok)',
        warn:         'var(--warn)',
        crit:         'var(--crit)',
        info:         'var(--info)',
        'ok-dim':     'var(--ok-dim)',
        'warn-dim':   'var(--warn-dim)',
        'crit-dim':   'var(--crit-dim)',
        sidebar:      'var(--sidebar)',
        topbar:       'var(--topbar)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Roboto Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.7rem',   { lineHeight: '1.1rem' }],
        '3xs': ['0.575rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        panel:    '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
        'panel-lg': '0 4px 16px rgba(0,0,0,0.24)',
      },
      animation: {
        'status-pulse': 'statusPulse 2s ease-in-out infinite',
        'crit-flash':   'critFlash 1.2s ease-in-out infinite',
        'fade-in':      'fadeIn 0.2s ease-out',
        'slide-in':     'slideIn 0.25s ease-out',
        /* legacy (SplashPage/Discovery) */
        'pulse-fast':   'pulse 1.2s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-up':     'slideUp 0.35s ease-out',
        'scan':         'scan 8s linear infinite',
      },
      keyframes: {
        statusPulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        critFlash:   { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.25' } },
        fadeIn:      { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn:     { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        slideUp:     { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scan:        { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100vh)' } },
      },
    },
  },
  plugins: [],
};
