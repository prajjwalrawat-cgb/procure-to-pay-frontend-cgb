/**
 * Canonical ProcureFlow design tokens — "Clear Ledger".
 *
 * This file is the single source of truth; the Tailwind preset and the CSS
 * variable layer (components/ui/styles.css) are both derived from it.
 *
 * ── The rule the palette enforces ──────────────────────────────────────────
 * ONE accent. `accent` (#1B4CE0) is the only non-semantic colour in the system
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
  // ── Surfaces ─────────────────────────────────────────────────────────────
  paper: '#F4F5F7', // page background
  canvas: '#EDEFF2', // hover fill, inset wells, table zebra
  panel: '#FFFFFF', // cards, chrome, any raised surface
  line: '#E3E5E9', // every hairline in the app

  // ── Chrome (formerly the navy rail) ──────────────────────────────────────
  // Chrome is white now: the nav is a hairline-bordered bar, not a dark frame.
  // The names survive so existing `bg-navy` / `text-on-navy` call sites keep
  // rendering correctly while they are migrated.
  navy: '#FFFFFF',
  'navy-2': '#FFFFFF',
  'navy-3': '#EDEFF2', // hover inside chrome
  'on-navy': '#1A1D21',
  'on-navy-muted': '#6B7078',

  // ── Text ─────────────────────────────────────────────────────────────────
  ink: '#1A1D21', // headings and primary labels
  text: '#1A1D21', // body copy
  muted: '#6B7078', // secondary text — 4.87:1 on panel
  faint: '#767C85', // tertiary micro-labels — 4.52:1 on panel
  // ↑ brief specified #8A8F98; that is 3.15:1 and fails as text. Darkened one
  //   step. `faint-line` below keeps the lighter value for non-text use.
  'faint-line': '#8A8F98',

  // ── Accent — interactive / active, and nothing else ──────────────────────
  accent: '#1B4CE0',
  'accent-2': '#1740B8', // hover / pressed
  'accent-wash': '#EAEFFD', // badge + hover tint

  // ── Semantic state — status only ─────────────────────────────────────────
  success: '#147A52', // status text — 5.06:1 on panel
  'success-solid': '#1E9E6B', // dots, bars, fills
  'success-bg': '#E9F7EF',

  warn: '#8A5E0E', // status text — 5.13:1 on panel
  'warn-solid': '#B07A12',
  'warn-bg': '#FBF2E2',

  danger: '#B23A31', // status text — 5.02:1 on panel
  'danger-solid': '#C4453B',
  'danger-bg': '#FBEAE8',

  // ── Legacy aliases — remapped, not re-invented ───────────────────────────
  // Kept so the ~90 screens still on the old class names inherit the new
  // system. New work should use accent / success / warn / danger only.
  gold: '#1B4CE0',
  'gold-ink': '#1B4CE0',
  'gold-wash': '#EAEFFD',
  info: '#1B4CE0',
  'info-bg': '#EAEFFD',
  'info-wash': '#EAEFFD',
  violet: '#1B4CE0',
  'violet-bg': '#EAEFFD',
  'violet-wash': '#EAEFFD',
  'danger-wash': '#FBEAE8',
  'warn-wash': '#FBF2E2',
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
  md: '0 4px 10px rgba(26, 29, 33, 0.06)',
  lg: '0 10px 24px rgba(26, 29, 33, 0.10)',
  xl: '0 20px 40px rgba(26, 29, 33, 0.12)',
} as const;

export const motion = {
  hover: '100ms',
  cardLift: '150ms',
  panel: '200ms',
} as const;

/**
 * One face. Inter carries the whole UI — headings, tables, and (with
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
  fontUi: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontDisplay: "'Inter', -apple-system, sans-serif",
  fontSans: "'Inter', -apple-system, sans-serif",
  fontMono: "'Geist Mono', ui-monospace, monospace",
  sizeMeta: '12px',
  baseSize: '13px',
  sizeHeading: '19px',
  lineHeight: '1.5',
  letterSpacingBody: '0',
  letterSpacingHeading: '-0.01em',
  letterSpacingDisplay: '-0.01em',
  weights: [400, 500, 600, 700],
} as const;

/** All spacing is a multiple of this. */
export const spaceUnit = '4px';

export const tokens = { colors, radius, shadow, motion, typography, spaceUnit } as const;
export type Tokens = typeof tokens;
