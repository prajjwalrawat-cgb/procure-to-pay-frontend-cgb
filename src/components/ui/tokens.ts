/**
 * Canonical ProcureFlow design tokens — "Midnight Executive".
 *
 * This file is the single source of truth; the Tailwind preset and the CSS
 * variable layer are both derived from it. Nothing below is decorative: every
 * value carries either a contrast obligation or a semantic rule.
 *
 * ── The three registers ────────────────────────────────────────────────────
 *  1. NAVY is chrome. Sidebar, topbar, document headers, table header seams.
 *     It is the institutional frame around the data, never the data surface —
 *     this app renders dense 13.5px financial tables and long ₹ columns, which
 *     are materially harder to scan on a dark ground.
 *  2. ICE is surface. Page canvas and panels sit in a cool near-white range so
 *     the navy chrome reads as a deliberate frame rather than an accident.
 *  3. GOLD is consequence. It marks money-moving and commitment actions only —
 *     approve, award, release a payment run. It is NOT a brand accent and must
 *     never appear as decoration. This rule is enforced at the component API
 *     (`<Button variant="commit">`), not by convention.
 *
 * ── Contrast ───────────────────────────────────────────────────────────────
 * Every foreground token below was computed against the surface it is actually
 * used on and meets WCAG 2.1 AA (4.5:1) as body text. The previous palette had
 * this same discipline (see git history / docs/compliance/accessibility-review.md);
 * the ratios were recomputed for the new hues rather than carried over.
 */

export const colors = {
  // ── Ice surfaces (the data ground) ───────────────────────────────────────
  paper: '#F4F7FB', // page background — ice-tinted, not neutral grey
  canvas: '#E9EFF7', // below panels, table header fill, inset wells
  panel: '#FFFFFF',

  // ── Navy chrome (the institutional frame) ────────────────────────────────
  navy: '#0A1424', // near-black navy base — sidebar, deepest chrome
  'navy-2': '#142338', // true ink-blue — elevated chrome, doc headers
  'navy-3': '#1C2F49', // hover / active state within navy chrome
  'on-navy': '#E6EDF7', // primary text on navy — 8.4:1 (AAA)
  'on-navy-muted': '#9FB0C8', // secondary text on navy — 8.38:1 on navy base

  // ── Ink & text (on ice surfaces) ─────────────────────────────────────────
  ink: '#0A1424', // primary text / headings — shares the navy base hue
  text: '#1F2C40', // body copy
  // Three-tier hierarchy preserved under the AA floor: faint stays lighter
  // than muted, but the usable range is compressed by the 4.5:1 requirement.
  muted: '#55647C', // 5.19:1 on canvas — secondary text
  faint: '#5D6B80', // 4.73:1 on canvas — tertiary micro-labels
  line: '#D4DEEC', // ice border

  // ── Gold / brass — consequence only ──────────────────────────────────────
  // Two values because one gold cannot serve both grounds: a gold bright
  // enough to sit on navy (7.2:1) is ~1.9:1 on white and illegible as text.
  gold: '#C89B2C', // on-navy fills, seams, borders — 7.20:1 on navy
  'gold-ink': '#8A6A12', // gold-as-text on light — 5.09:1 on panel, 4.65:1 on wash
  'gold-wash': '#FBF4E2', // pale brass surface

  // ── Semantic states — tuned to sit beside navy, not fight it ─────────────
  accent: '#0F7A52', // deep emerald — 5.34:1 on panel. Positive/complete.
  'accent-2': '#0B6141',
  'accent-wash': '#E8F5EF',

  danger: '#C2183F', // 5.99:1 on panel
  'danger-bg': '#FBD8DF',
  'danger-wash': '#FEF2F4',

  warn: '#9A5B02', // 5.35:1 on panel
  'warn-bg': '#FBEBCC',
  'warn-wash': '#FDF8EE',

  info: '#1D5FA8', // 6.38:1 on panel
  'info-bg': '#D8E6F7',
  'info-wash': '#EFF5FC',

  violet: '#6D3BC7',
  'violet-bg': '#E5DDF7',
  'violet-wash': '#F4F0FD',
} as const;

export const radius = {
  xs: '4px',
  sm: '6px',
  DEFAULT: '8px',
  lg: '12px',
  xl: '16px',
} as const;

/**
 * Shadows are navy-tinted rather than neutral-black. On an ice ground a pure
 * black shadow reads as grime; a blue-black one reads as depth.
 */
export const shadow = {
  xs: '0 1px 2px rgba(10, 20, 36, 0.05)',
  sm: '0 1px 3px rgba(10, 20, 36, 0.07), 0 1px 2px rgba(10, 20, 36, 0.04)',
  md: '0 4px 8px rgba(10, 20, 36, 0.07), 0 2px 4px rgba(10, 20, 36, 0.04)',
  lg: '0 12px 24px rgba(10, 20, 36, 0.10), 0 4px 8px rgba(10, 20, 36, 0.05)',
  xl: '0 24px 48px rgba(10, 20, 36, 0.12), 0 8px 16px rgba(10, 20, 36, 0.06)',
} as const;

export const motion = {
  hover: '100ms',
  cardLift: '150ms',
  panel: '200ms',
} as const;

/**
 * Three faces, three jobs:
 *  - display — module headers and KPI values only, and only at >=18px. A serif
 *    at table sizes reads dated and hurts scanning, so `.font-display` is the
 *    only way to reach it and it is never applied inside a table.
 *  - sans — the body/table face. Optimized for dense rows at 13.5px.
 *  - mono — money, dates, IDs, hashes. Always with tabular figures so ₹ columns
 *    align down the page.
 */
export const typography = {
  fontDisplay: "'Source Serif 4', ui-serif, Georgia, serif",
  fontSans: "'Geist', ui-sans-serif, sans-serif",
  fontMono: "'Geist Mono', ui-monospace, monospace",
  baseSize: '13.5px',
  lineHeight: '1.5',
  letterSpacingBody: '-0.005em',
  letterSpacingHeading: '-0.02em',
  letterSpacingDisplay: '-0.02em',
  displayMinSize: '18px',
  weights: [400, 500, 600, 700],
} as const;

export const tokens = { colors, radius, shadow, motion, typography } as const;
export type Tokens = typeof tokens;
