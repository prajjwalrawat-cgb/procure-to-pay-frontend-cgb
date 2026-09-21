/**
 * Canonical ProcureFlow design tokens — "Clear Ledger".
 *
 * This file is the single source of truth; the Tailwind preset and the CSS
 * variable layer (components/ui/styles.css) are both derived from it.
 *
 * ── The rule the palette enforces ──────────────────────────────────────────
 * ONE accent. `accent` (emerald, #047857) is the only non-semantic colour in the system
 * and it means "interactive or active" — the current nav pill, a primary
 * button, a focused input, a link. Everything else is either a neutral surface
 * or a semantic state.
 *
 * State colour (`success` / `warn` / `danger`) is reserved for status. It never
 * decorates. A row is red because the invoice failed matching, not because red
 * looked good there.
 *
 * The previous palette carried five decorative hues (navy chrome, gold
 * "consequence", violet, info-blue, emerald-as-accent). Screens ended up
 * competing with each other for attention and no colour meant anything
 * reliably. The legacy names are kept below and remapped rather than deleted,
 * so ~90 screens inherit the new system without a per-screen rewrite:
 *
 *   gold / gold-ink / gold-wash → accent        (was: "consequence" actions)
 *   violet / violet-*           → accent        (was: held / classification)
 *   info / info-*               → accent        (was: in-flight)
 *   navy / navy-2 / navy-3      → white chrome  (was: dark rail + topbar)
 *   on-navy / on-navy-muted     → dark text     (chrome is light now)
 *
 * ── Contrast ───────────────────────────────────────────────────────────────
 * Every token used as text meets WCAG 2.1 AA (4.5:1) on the surface it sits
 * on. Three values are one step darker than the brief's hexes for exactly that
 * reason — the brief's #8A8F98 (text-faint), #1E9E6B (success), #C4453B
 * (error) are 3.1:1, 2.9:1 and 4.2:1 as text on white and cannot carry a
 * status label. The brief's values are kept for fills, dots and bars, where
 * contrast is not a text obligation, as the `-solid` variants.
 */

export const colors = {
  // ── Surfaces — warm, not blue-grey ───────────────────────────────────────
  paper: '#FAF9F6', // page background — warm off-white
  canvas: '#F2F0EB', // hover fill, inset wells, table zebra
  panel: '#FFFFFF', // cards, chrome, any raised surface
  line: '#E6E3DC', // every hairline in the app

  // ── Chrome (formerly the navy rail) ──────────────────────────────────────
  // Chrome is white: the nav is a hairline-bordered bar, not a dark frame.
  // The names survive so existing `bg-navy` / `text-on-navy` call sites keep
  // rendering correctly.
  navy: '#FFFFFF',
  'navy-2': '#FFFFFF',
  'navy-3': '#F2F0EB', // hover inside chrome
  'on-navy': '#1C1B18',
  'on-navy-muted': '#66625A',

  // ── Text — warm neutrals ─────────────────────────────────────────────────
  ink: '#1C1B18', // headings and primary labels
  text: '#1C1B18', // body copy
  muted: '#66625A', // secondary text — 5.9:1 on panel
  faint: '#75716A', // tertiary micro-labels — 4.8:1 on panel
  'faint-line': '#A19D94', // non-text only: dots, dividers, placeholder bars

  // ── Accent — emerald; interactive / active, and nothing else ────────────
  accent: '#047857', // 5.5:1 on panel — holds AA as link text
  'accent-2': '#065F46', // hover / pressed
  'accent-wash': '#E6F4EE', // selected row, badge + hover tint

  // ── Semantic state — status only, never decoration ──────────────────────
  success: '#15803D', // status text — 5.0:1 on panel
  'success-solid': '#22A55A', // dots, bars, fills
  'success-bg': '#EAF6EE',

  warn: '#8A5A0B', // status text — 5.6:1 on panel
  'warn-solid': '#C98A12',
  'warn-bg': '#FBF3E3',

  danger: '#B42318', // status text — 6.2:1 on panel
  'danger-solid': '#D92D20',
  'danger-bg': '#FDECEA',

  // In flight: submitted, scheduled, being read, partly paid. The only blue in
  // the product — it means "moving, nothing for you to do yet".
  info: '#1D4ED8', // status text — 6.7:1 on panel
  'info-solid': '#3B82F6',
  'info-bg': '#EBF2FE',
  'info-wash': '#EBF2FE',

  // ── Legacy aliases — remapped, not re-invented ───────────────────────────
  gold: '#047857',
  'gold-ink': '#047857',
  'gold-wash': '#E6F4EE',
  violet: '#047857',
  'violet-bg': '#E6F4EE',
  'violet-wash': '#E6F4EE',
  'danger-wash': '#FDECEA',
  'warn-wash': '#FBF3E3',
} as const;

/**
 * Radii. The brief fixes two: 8px for cards and panels, 16px for the nav pill.
 * 5px is the control radius (buttons, inputs) — deliberately tighter than the
 * card so a button inside a card does not echo its corner.
 */
export const radius = {
  xs: '4px',
  sm: '5px', // controls: buttons, inputs, selects
  DEFAULT: '8px',
  lg: '8px', // cards — same as DEFAULT; the brief has one card radius
  xl: '12px',
  pill: '16px',
} as const;

/**
 * Shadows exist for genuinely floating layers only — dialogs, popovers,
 * dropdowns. Cards and tables are separated by hairlines, never by elevation,
 * so `sm` and below are intentionally near-invisible: a card that still calls
 * `shadow-sm` from before the redesign reads flat.
 */
export const shadow = {
  xs: '0 0 0 0 rgba(0,0,0,0)',
  sm: '0 0 0 0 rgba(0,0,0,0)',
  md: '0 4px 10px rgba(28, 27, 24, 0.06)',
  lg: '0 10px 24px rgba(28, 27, 24, 0.10)',
  xl: '0 20px 40px rgba(28, 27, 24, 0.12)',
} as const;

export const motion = {
  hover: '100ms',
  cardLift: '150ms',
  panel: '200ms',
} as const;

/**
 * One face. Geist carries the whole UI — headings, tables, and (with
 * `font-variant-numeric: tabular-nums`) every ₹ amount, quantity and date.
 *
 * The previous system ran three faces including a display serif at page
 * headers. A serif header above a 13px data table reads as two products
 * stapled together; the redesign's register is a single neutral grotesque at
 * three sizes. `.font-display` survives as a *weight/size* treatment rather
 * than a different family, so page headers did not all need rewriting.
 *
 * Mono is kept for one job only: hash chains and machine identifiers in the
 * audit log, where character-level distinction is the point.
 */
export const typography = {
  fontUi: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontDisplay: "'Geist', -apple-system, sans-serif",
  fontSans: "'Geist', -apple-system, sans-serif",
  fontMono: "'Geist Mono', ui-monospace, monospace",
  sizeMeta: '12px',
  baseSize: '14px',
  sizeHeading: '22px',
  lineHeight: '1.5',
  letterSpacingBody: '0',
  letterSpacingHeading: '-0.015em',
  letterSpacingDisplay: '-0.02em',
  weights: [400, 500, 600, 700],
} as const;

/**
 * The type scale. Every text size in the app is one of these — components use
 * the Tailwind utilities (`text-body`, `text-h2`, …), never `text-body-sm`.
 *
 *   display  28  KPI figures, the one big number on a screen
 *   h1       22  page titles
 *   h2       18  section headings, card-level figures
 *   h3       15  card titles, sub-section headings
 *   body     14  default reading text
 *   body-sm  13  dense table cells, form controls
 *   caption  12  column headers, metadata, helper text
 *   micro    11  badges, counts, timestamps
 */
export const typeScale = {
  display: ['28px', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
  h1: ['22px', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
  h2: ['18px', { lineHeight: '1.35', letterSpacing: '-0.01em' }],
  h3: ['15px', { lineHeight: '1.4', letterSpacing: '-0.005em' }],
  body: ['14px', { lineHeight: '1.55' }],
  'body-sm': ['13px', { lineHeight: '1.5' }],
  caption: ['12px', { lineHeight: '1.45' }],
  micro: ['11px', { lineHeight: '1.4' }],
} as const;

/** All spacing is a multiple of this. */
export const spaceUnit = '4px';

export const tokens = { colors, radius, shadow, motion, typography, typeScale, spaceUnit } as const;
export type Tokens = typeof tokens;
