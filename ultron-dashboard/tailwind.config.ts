import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../packages/hmi-ui/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* ── Backgrounds ── */
        'c-void':    '#010a14',
        'c-deep':    '#020e1c',
        'c-dark':    '#04152a',
        'c-surface': '#061c30',
        'c-raised':  '#0a2540',
        /* ── Borders ── */
        'c-line':    '#0d3050',
        'c-glow':    '#154a70',
        /* ── Text ── */
        'c-bright':  '#d8eef8',
        'c-mid':     '#4a7a96',
        'c-dim':     '#183248',
        /* ── Accents ── */
        'c-cyan':    '#00d4ff',
        'c-blue':    '#0077ff',
        'c-teal':    '#00c8a0',
        /* ── Status ── */
        'c-ok':      '#00d68f',
        'c-warn':    '#ffb830',
        'c-crit':    '#ff2d55',
        'c-off':     '#1d3a52',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        'panel':        '0 4px 40px rgba(0,0,0,0.7)',
        'card':         '0 2px 20px rgba(0,0,0,0.5)',
        'glow-cyan':    '0 0 30px rgba(0,212,255,0.12), inset 0 0 30px rgba(0,212,255,0.02)',
        'glow-ok':      '0 0 24px rgba(0,214,143,0.18)',
        'glow-warn':    '0 0 24px rgba(255,184,48,0.18)',
        'glow-crit':    '0 0 24px rgba(255,45,85,0.22)',
        'inner-hi':     'inset 0 1px 0 rgba(255,255,255,0.04)',
      },
      backgroundImage: {
        'grid-faint': `
          linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)
        `,
        'radial-center': 'radial-gradient(ellipse 120% 70% at 50% 20%, rgba(0,100,255,0.05) 0%, transparent 65%)',
      },
      backgroundSize: {
        'grid':   '50px 50px',
      },
      fontSize: {
        '2xs': ['0.7rem',   { lineHeight: '1.1rem' }],
        '3xs': ['0.575rem', { lineHeight: '0.875rem' }],
      },
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'pulse-fast':   'pulse 1.2s cubic-bezier(0.4,0,0.6,1) infinite',
        'status-pulse': 'statusPulse 2s ease-in-out infinite',
        'fade-in':      'fadeIn 0.5s ease-out',
        'slide-up':     'slideUp 0.35s ease-out',
        'slide-in':     'slideIn 0.25s ease-out',
        'crit-flash':   'critFlash 1.4s ease-in-out infinite',
        'scan':         'scan 8s linear infinite',
        'data-blink':   'dataBlink 0.9s step-start infinite',
        'glow-breathe': 'glowBreathe 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:      { from: { opacity: '0' },                           to: { opacity: '1' } },
        slideUp:     { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideIn:     { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        statusPulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        critFlash:   { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
        scan:        { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100vh)' } },
        dataBlink:   { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
        glowBreathe: { '0%,100%': { opacity: '0.5' }, '50%': { opacity: '1' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
