import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="black"], [data-theme="dark"], .on-black, .on-dark'],
  theme: {
    extend: {
      colors: {
        petroleum: {
          50: 'var(--petroleum-050)', 100: 'var(--petroleum-100)', 200: 'var(--petroleum-200)',
          300: 'var(--petroleum-300)', 500: 'var(--petroleum-500)', 600: 'var(--petroleum-600)',
          700: 'var(--petroleum-700)', 800: 'var(--petroleum-800)', 900: 'var(--petroleum-900)',
          950: 'var(--petroleum-950)',
        },
        lime: {
          50: 'var(--lime-050)', 100: 'var(--lime-100)', 300: 'var(--lime-300)',
          500: 'var(--lime-500)', 600: 'var(--lime-600)',
        },
        canvas: 'var(--bg-canvas)',
        'canvas-subtle': 'var(--bg-subtle)',
        surface: 'var(--surface-card)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        border: 'var(--border-default)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        xs: 'var(--radius-xs)', sm: 'var(--radius-sm)', DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)', lg: 'var(--radius-lg)', xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)', sm: 'var(--shadow-sm)', md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)', xl: 'var(--shadow-xl)', lime: 'var(--shadow-lime)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)', 'in-out': 'var(--ease-in-out)',
      },
    },
  },
  plugins: [],
};

export default config;
