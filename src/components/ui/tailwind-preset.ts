import type { Config } from 'tailwindcss';

import { colors, radius, shadow } from './tokens';

/**
 * Shared Tailwind preset (Master Context §6). Apps extend this so all colors,
 * radii, and shadows are available as utilities and CSS variables. Fonts are
 * wired per-app via next/font to preserve the Geist requirement.
 */
const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        paper: colors.paper,
        canvas: colors.canvas,
        panel: colors.panel,
        ink: colors.ink,
        text: colors.text,
        muted: colors.muted,
        faint: colors.faint,
        line: colors.line,
        accent: {
          DEFAULT: colors.accent,
          2: colors['accent-2'],
          wash: colors['accent-wash'],
        },
        danger: {
          DEFAULT: colors.danger,
          bg: colors['danger-bg'],
          wash: colors['danger-wash'],
        },
        warn: {
          DEFAULT: colors.warn,
          bg: colors['warn-bg'],
          wash: colors['warn-wash'],
        },
        info: {
          DEFAULT: colors.info,
          bg: colors['info-bg'],
          wash: colors['info-wash'],
        },
        violet: {
          DEFAULT: colors.violet,
          bg: colors['violet-bg'],
          wash: colors['violet-wash'],
        },
      },
      borderRadius: {
        xs: radius.xs,
        sm: radius.sm,
        DEFAULT: radius.DEFAULT,
        lg: radius.lg,
        xl: radius.xl,
      },
      boxShadow: {
        xs: shadow.xs,
        sm: shadow.sm,
        md: shadow.md,
        lg: shadow.lg,
        xl: shadow.xl,
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        base: ['13.5px', { lineHeight: '1.5', letterSpacing: '-0.005em' }],
      },
      letterSpacing: {
        heading: '-0.02em',
        display: '-0.03em',
      },
      transitionDuration: {
        hover: '100ms',
        card: '150ms',
        panel: '200ms',
      },
    },
  },
};

export default preset;
