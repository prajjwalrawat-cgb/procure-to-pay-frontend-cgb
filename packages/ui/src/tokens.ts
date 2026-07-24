/**
 * Canonical ProcureFlow design tokens — locked from the v6 mockup
 * (Master Context §6). This file is the single source of truth; the Tailwind
 * preset and the CSS variable layer are both derived from it.
 */

export const colors = {
  paper: '#FAFAF7', // page background
  canvas: '#F5F5F1', // canvas below panels
  panel: '#FFFFFF',
  ink: '#0A0A0A', // primary text, primary button
  text: '#2E2E2C',
  // Slice 11b — muted/faint darkened to meet WCAG 2.1 AA (4.5:1) as body text.
  // Was #78786F (4.08:1) / #A3A39B (2.43:1) — both failed on canvas. See
  // docs/compliance/accessibility-review.md. Three-tier hierarchy preserved
  // (faint stays lighter than muted); the range is compressed by the AA floor.
  muted: '#65655E', // 5.37:1 on canvas — secondary text
  faint: '#70706B', // 4.55:1 on canvas — tertiary micro-labels
  line: '#E8E8E1',

  // accent darkened emerald-600 #059669 (3.77:1, failed as text & as button
  // label bg) → #05835C: 4.76:1 on panel, 4.52:1 on accent-wash. Symmetric, so
  // it fixes both accent-as-text and white-on-accent primary buttons.
  accent: '#05835C', // emerald — single accent color
  'accent-2': '#047857',
  'accent-wash': '#ECFDF5',

  danger: '#DA1C46', // was #E11D48 (4.28:1 on danger-wash) → 4.51:1
  'danger-bg': '#FFE4E6',
  'danger-wash': '#FFF1F2',

  warn: '#AF6005', // was #D97706 (3.07:1 on warn-wash) → 4.50:1
  'warn-bg': '#FEF3C7',
  'warn-wash': '#FFFBEB',

  info: '#0276B2', // was #0284C7 (3.76:1 on info-wash) → 4.55:1
  'info-bg': '#DBEAFE',
  'info-wash': '#EFF6FF',

  violet: '#7C3AED',
  'violet-bg': '#EDE9FE',
  'violet-wash': '#F5F3FF',
} as const;

export const radius = {
  xs: '4px',
  sm: '6px',
  DEFAULT: '8px',
  lg: '12px',
  xl: '16px',
} as const;

export const shadow = {
  xs: '0 1px 2px rgba(10, 10, 10, 0.04)',
  sm: '0 1px 3px rgba(10, 10, 10, 0.06), 0 1px 2px rgba(10, 10, 10, 0.04)',
  md: '0 4px 8px rgba(10, 10, 10, 0.06), 0 2px 4px rgba(10, 10, 10, 0.04)',
  lg: '0 12px 24px rgba(10, 10, 10, 0.08), 0 4px 8px rgba(10, 10, 10, 0.04)',
  xl: '0 24px 48px rgba(10, 10, 10, 0.10), 0 8px 16px rgba(10, 10, 10, 0.05)',
} as const;

export const motion = {
  hover: '100ms',
  cardLift: '150ms',
  panel: '200ms',
} as const;

export const typography = {
  fontSans: "'Geist', ui-sans-serif, sans-serif",
  fontMono: "'Geist Mono', ui-monospace, monospace",
  baseSize: '13.5px',
  lineHeight: '1.5',
  letterSpacingBody: '-0.005em',
  letterSpacingHeading: '-0.02em',
  letterSpacingDisplay: '-0.03em',
  weights: [400, 500, 600, 700],
} as const;

export const tokens = { colors, radius, shadow, motion, typography } as const;
export type Tokens = typeof tokens;
