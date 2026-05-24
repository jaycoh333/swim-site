import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        crt: '#7CFF5B',
        phosphor: '#B9FF9C',
        void: '#020403',
        moss: '#102010',
        amber: '#D7A85C'
      },
      fontFamily: {
        mono: ['var(--font-vt323)', 'var(--font-share-tech)', 'ui-monospace', 'monospace'],
        terminal: ['var(--font-vt323)', 'monospace'],
        'share-tech': ['var(--font-share-tech)', 'monospace'],
        'ibm-plex': ['var(--font-ibm-plex)', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 18px rgba(124,255,91,.35)',
        'glow-sm': '0 0 8px rgba(124,255,91,.25)',
        'glow-lg': '0 0 40px rgba(124,255,91,.18)',
        'glow-xl': '0 0 80px rgba(124,255,91,.1)',
        panel: '0 0 0 1px rgba(124,255,91,.35), inset 0 0 20px rgba(124,255,91,.06)',
        'panel-active': '0 0 0 1px rgba(124,255,91,.6), inset 0 0 30px rgba(124,255,91,.1)',
      },
      animation: {
        blink: 'blink 1.1s steps(2, start) infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
        'text-flicker': 'text-flicker 4s linear infinite',
        'scan-beam': 'scan-beam 8s linear infinite',
        'grid-shift': 'grid-shift 25s linear infinite',
        drift: 'drift 4s ease-in-out infinite',
        glitch: 'glitch 5s infinite',
        'float-in': 'float-in 0.6s ease-out forwards',
      },
      keyframes: {
        blink: { '50%': { opacity: '0' } },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.65' },
        },
        'text-flicker': {
          '0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%': { opacity: '0.99' },
          '20%, 24%, 55%': { opacity: '0.4' },
        },
        'scan-beam': {
          '0%': { transform: 'translateY(-100vh)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'grid-shift': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 40px' },
        },
        drift: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glitch: {
          '0%, 90%, 100%': { transform: 'translate(0)', filter: 'none' },
          '92%': { transform: 'translate(-2px, 0)', filter: 'hue-rotate(90deg)' },
          '94%': { transform: 'translate(2px, 0)', filter: 'hue-rotate(-90deg)' },
          '96%': { transform: 'translate(0)', filter: 'none' },
        },
        'float-in': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    }
  },
  plugins: []
};
export default config;
