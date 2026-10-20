import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4fb',
          100: '#d6e4f4',
          500: '#1a4a7c',
          600: '#143c66',
          700: '#102a45',
          900: '#0c1a2e',
        },
        accent: {
          500: '#e33326',
          600: '#c42a1f',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      maxWidth: { site: '1240px' },
    },
  },
  plugins: [typography],
} satisfies Config;
