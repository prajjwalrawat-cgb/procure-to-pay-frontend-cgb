import type { Config } from 'tailwindcss';

import { colors, radius, shadow, typeScale } from './tokens';

/**
 * Shared Tailwind preset. Apps extend this so all colours, radii and shadows
 * are available as utilities. Fonts are wired per-app via next/font so the
 * self-hosted faces keep their CSS variables.
 *
 * The legacy colour names (gold, violet, navy) are still exported as
 * utilities, but they now resolve to the accent or to white chrome — see
 * tokens.ts. That is what lets ~90 screens adopt the redesign without a
 * per-screen rewrite of every className.
 */
const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        paper: colors.paper,
        canvas: colors.canvas,
        panel: colors.panel,
        line: colors.line,

        // Chrome. White now — names kept for un-migrated call sites.
        navy: {
          DEFAULT: colors.navy,
          2: colors['navy-2'],
          3: colors['navy-3'],
        },
        'on-navy': {
          DEFAULT: colors['on-navy'],
          muted: colors['on-navy-muted'],
        },

        ink: colors.ink,
        text: colors.text,
        muted: colors.muted,
        faint: {
          DEFAULT: colors.faint,
          line: colors['faint-line'],
        },

        // The one accent. Interactive/active only.
        accent: {
          DEFAULT: colors.accent,
          2: colors['accent-2'],
          wash: colors['accent-wash'],
          bg: colors['accent-wash'],
          tint: colors['accent-tint'],
          mid: colors['accent-mid'],
          soft: colors['accent-soft'],
        },

        // Semantic state. Status only, never decoration.
        success: {
          DEFAULT: colors.success,
          solid: colors['success-solid'],
          bg: colors['success-bg'],
          wash: colors['success-bg'],
        },
        warn: {
          DEFAULT: colors.warn,
          solid: colors['warn-solid'],
          bg: colors['warn-bg'],
          wash: colors['warn-wash'],
        },
        danger: {
          DEFAULT: colors.danger,
          solid: colors['danger-solid'],
          bg: colors['danger-bg'],
          wash: colors['danger-wash'],
        },

        // ── Legacy aliases (gold, violet) remapped to the accent ──────────
        gold: {
          DEFAULT: colors.gold,
          ink: colors['gold-ink'],
          wash: colors['gold-wash'],
        },
        info: {
          DEFAULT: colors.info,
          solid: colors['info-solid'],
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
        pill: radius.pill,
      },
      boxShadow: {
        xs: shadow.xs,
        sm: shadow.sm,
        md: shadow.md,
        lg: shadow.lg,
        xl: shadow.xl,
      },
      fontFamily: {
        // `display` is the same family as `sans` — it is a size/weight
        // treatment, not a second face. See tokens.ts → typography.
        display: ['var(--font-ui)', '-apple-system', 'sans-serif'],
        sans: ['var(--font-ui)', '-apple-system', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // The type scale — see tokens.ts → typeScale.
        ...(typeScale as unknown as Record<string, [string, Record<string, string>]>),
        // Older names, kept as aliases onto the scale.
        meta: typeScale.caption as unknown as [string, Record<string, string>],
        base: typeScale.body as unknown as [string, Record<string, string>],
        heading: typeScale.h1 as unknown as [string, Record<string, string>],
      },
      letterSpacing: {
        heading: '-0.015em',
        display: '-0.02em',
      },
      transitionDuration: {
        hover: '100ms',
        card: '150ms',
        panel: '200ms',
      },
      keyframes: {
        'ledger-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'ledger-pulse': 'ledger-pulse 2s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
};

export default preset;
