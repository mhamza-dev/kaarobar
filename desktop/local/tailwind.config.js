/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'sans-serif'],
        ur: ['Noto Sans Arabic', 'Noto Naskh Arabic', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        brand: {
          primary: 'rgb(var(--brand-primary) / <alpha-value>)',
          'primary-hover': 'rgb(var(--brand-primary-hover) / <alpha-value>)',
          'primary-active': 'rgb(var(--brand-primary-active) / <alpha-value>)',
          tint: 'rgb(var(--brand-tint) / <alpha-value>)',
          'on-primary': 'rgb(var(--brand-on-primary) / <alpha-value>)',
        },
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-raised': 'rgb(var(--surface-raised) / <alpha-value>)',
        'surface-muted': 'rgb(var(--surface-muted) / <alpha-value>)',
        'surface-sunken': 'rgb(var(--surface-sunken) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-muted': 'rgb(var(--ink-muted) / <alpha-value>)',
        'ink-subtle': 'rgb(var(--ink-subtle) / <alpha-value>)',
        'ink-inverse': 'rgb(var(--ink-inverse) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        'danger-soft': 'rgb(var(--danger-soft) / <alpha-value>)',
        'danger-on': 'rgb(var(--danger-on) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        'success-soft': 'rgb(var(--success-soft) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        'warning-soft': 'rgb(var(--warning-soft) / <alpha-value>)',
      },
      boxShadow: {
        soft: '0 2px 12px rgba(15, 23, 42, 0.07)',
        lift: '0 16px 36px rgba(15, 23, 42, 0.14)',
        glow: '0 0 0 1px rgba(45, 109, 246, 0.12), 0 8px 24px rgba(45, 109, 246, 0.12)',
      },
      transitionDuration: {
        pos: '180ms',
      },
    },
  },
  plugins: [],
}

