/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* ─── Brand Colors ──────────────────────────────── */
      colors: {
        brand: {
          navy:    '#0c2340',
          dark:    '#102a45',
          deeper:  '#0c1a2e',
          red:     '#e33326',
          accent:  '#1a4a7c',
          green:   '#064E3B',
          purple:  '#5D5FEF',
        },
        surface: {
          page:    '#f5f6fa',
          card:    '#ffffff',
          hover:   '#fef7f6',
        },
      },
      /* ─── Typography ────────────────────────────────── */
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      /* ─── Spacing & Layout ──────────────────────────── */
      maxWidth: {
        'site': '1400px',
      },
      /* ─── Animations ────────────────────────────────── */
      keyframes: {
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%':   { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.7' },
        },
      },
      animation: {
        'fade-in-up':     'fade-in-up 0.5s ease-out forwards',
        'fade-in':        'fade-in 0.3s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.4s ease-out forwards',
        'pulse-soft':     'pulse-soft 2s ease-in-out infinite',
      },
      /* ─── Transitions ──────────────────────────────── */
      transitionDuration: {
        DEFAULT: '200ms',
      },
      /* ─── Shadows ───────────────────────────────────── */
      boxShadow: {
        'card':      '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover':'0 10px 25px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.04)',
        'elevated':  '0 20px 40px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}