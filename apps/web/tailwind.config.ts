import type { Config } from 'tailwindcss';

const v = (name: string) => `var(--${name})`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      canvas: v('color-canvas'),
      paper: v('color-paper'),
      scrim: v('color-scrim'),
      skeleton: v('color-skeleton'),
      glass: { deep: v('glass-deep'), light: v('glass-light'), 'deep-edge': v('glass-deep-border'), 'light-edge': v('glass-light-border') },
      surface: { DEFAULT: v('color-surface'), muted: v('color-surface-muted'), strong: v('color-surface-strong') },
      shell: { DEFAULT: v('color-shell'), raised: v('color-shell-raised') },
      border: { DEFAULT: v('color-border'), strong: v('color-border-strong'), control: v('color-border-control') },
      ink: { DEFAULT: v('color-ink'), secondary: v('color-ink-secondary'), muted: v('color-ink-muted'), inverse: v('color-ink-inverse') },
      brand: { DEFAULT: v('color-brand'), strong: v('color-brand-strong') },
      'on-brand': v('color-on-brand'),
      accent: { DEFAULT: v('color-accent'), strong: v('color-accent-strong'), soft: v('color-accent-soft'), border: v('color-accent-border'), text: v('color-accent-text') },
      focus: v('color-focus'),
      zec: { DEFAULT: v('color-zec'), soft: v('color-zec-soft') },
      success: { DEFAULT: v('color-success'), soft: v('color-success-soft'), text: v('color-success-text') },
      warning: { DEFAULT: v('color-warning'), soft: v('color-warning-soft'), text: v('color-warning-text') },
      danger: { DEFAULT: v('color-danger'), strong: v('color-danger-strong'), soft: v('color-danger-soft'), text: v('color-danger-text') },
      info: { soft: v('color-info-soft') },
      sample: { DEFAULT: v('color-sample'), soft: v('color-sample-soft') },
    },
    extend: {
      fontFamily: { sans: v('font-sans'), serif: v('font-serif'), mono: v('font-mono') },
      fontSize: {
        'display-xl': [v('text-display-xl-size'), { lineHeight: '1.03', letterSpacing: '-0.035em', fontWeight: '500' }],
        'display-l': [v('text-display-l-size'), { lineHeight: '1.06', letterSpacing: '-0.03em', fontWeight: '500' }],
        display: ['clamp(2.5rem, 1.6rem + 3.6vw, 4.25rem)', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'body-l': [v('text-body-l-size'), { lineHeight: '1.6' }],
        h1: ['clamp(1.5rem, 1.3rem + 0.8vw, 1.875rem)', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' }],
        h2: ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.012em', fontWeight: '600' }],
        h3: ['1rem', { lineHeight: '1.35', letterSpacing: '-0.008em', fontWeight: '600' }],
        figure: ['1.625rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' }],
        'figure-s': ['1.25rem', { lineHeight: '1.2', letterSpacing: '-0.015em', fontWeight: '600' }],
        body: ['0.9375rem', { lineHeight: '1.55' }],
        'body-s': ['0.8125rem', { lineHeight: '1.5' }],
        label: ['0.75rem', { lineHeight: '1.3' }],
        micro: ['0.6875rem', { lineHeight: '1.25', letterSpacing: '0.01em' }],
      },
      borderRadius: { xs: v('radius-xs'), control: v('radius-control'), row: v('radius-row'), panel: v('radius-panel'), module: v('radius-module'), workspace: v('radius-workspace'), pill: v('radius-pill') },
      boxShadow: { raised: v('shadow-raised'), workspace: v('shadow-workspace'), floating: v('shadow-floating'), paper: v('shadow-paper') },
      spacing: { gutter: v('layout-gutter'), section: v('layout-section'), card: v('layout-card-padding'), rail: v('layout-rail'), topbar: v('layout-topbar'), 'bottom-nav': v('layout-bottom-nav'), control: '2.75rem', 'control-sm': '2.25rem' },
      transitionDuration: { fast: v('duration-fast'), standard: v('duration-standard') },
      transitionTimingFunction: { standard: v('ease-standard') },
      maxWidth: { content: v('layout-content'), form: '47.5rem', reading: '42rem' },
      backgroundImage: { stage: v('gradient-stage'), band: v('gradient-band'), 'panel-soft': v('gradient-panel-soft') },
    },
  },
  plugins: [],
};

export default config;
