/**
 * Chart tokens — the ProcureFlow instance of the data-viz parameter set.
 *
 * The previous analytics palette was emerald-anchored against the pre-refresh
 * tokens (#05835C accent, #E8E8E1 grid, #65655E axis text) and was never
 * validated for colour-vision separation. These values were.
 *
 * ── Validation (run, not eyeballed) ────────────────────────────────────────
 * Surface #FFFFFF (`panel`), light mode, categorical scope:
 *
 *   adjacent pairs (bar / column / line / stacked) — all 6 slots PASS
 *     worst CVD ΔE 9.3 (protan, brass↔teal), worst normal-vision ΔE 16.6
 *
 *   all pairs (pie / scatter / anything where every pair is co-visible)
 *     first 4 slots PASS with a CVD WARN (ΔE 6.8 deutan, violet↔azure) —
 *     legal only with secondary encoding, so those forms carry direct labels
 *     slot 5 FAILS (brass↔ochre ΔE 2.4 deutan / 10.4 normal)
 *
 * Hence CATEGORICAL_MAX_ALL_PAIRS below. Past four co-visible series, fold to
 * "Other" or switch form — do not add a seventh hue.
 *
 * Re-validate with the dataviz skill's `scripts/validate_palette.js` before
 * changing any value here. Ordering is the CVD-safety mechanism, not cosmetic:
 * teal and rose adjacent fails deutan at ΔE 0.7, which is why they are apart.
 *
 * ── Why these hues ─────────────────────────────────────────────────────────
 * Anchored on the Midnight Executive register (azure leads, cool hues carry
 * the weight) but deliberately spread wider than the brand palette. A palette
 * built only from navy/gold/ice cannot clear the CVD gate — the hues are too
 * close. Legibility wins over brand purity here.
 *
 * Status colours are NOT in the categorical set. They are reserved for
 * good/warn/serious/critical and always ship with a label or icon, never
 * colour alone.
 */

/** Categorical series, in fixed order. Never cycle; never generate a 7th. */
export const CHART_SERIES = [
  '#1F5FA8', // 1 azure
  '#C7622A', // 2 ochre
  '#7C3FD4', // 3 violet
  '#0F8A6A', // 4 teal
  '#A8850F', // 5 brass
  '#B4436C', // 6 rose
] as const;

/** Co-visible-pair forms (pie, scatter) may not exceed this many series. */
export const CATEGORICAL_MAX_ALL_PAIRS = 4;

/**
 * Status ramp for compliance state. Distinct from the categorical set and
 * always paired with a text label — never colour alone.
 */
export const CHART_STATUS = {
  good: '#0F7A52',
  warn: '#9A5B02',
  serious: '#C2183F',
  critical: '#8A0F2C',
} as const;

/**
 * Sequential ramp — one hue, light to dark, for magnitude (aging heat, spend
 * intensity). Never a rainbow.
 */
export const CHART_SEQUENTIAL = [
  '#DCE6F4',
  '#B4C9E6',
  '#7FA3D1',
  '#4A7CBA',
  '#1F5FA8',
  '#123A6B',
] as const;

/** Chart chrome, pulled from the app tokens so charts age with the palette. */
export const CHART_CHROME = {
  /** Chart sits on `panel`. The validator was run against this surface. */
  surface: '#FFFFFF',
  /** `line` — recessive gridlines, horizontal only. */
  grid: '#D4DEEC',
  /** `muted` — axis tick labels. */
  axis: '#55647C',
  /** `text` — value labels that must stay readable. */
  label: '#1F2C40',
  /** A prior-period or benchmark series: neutral, never a categorical slot. */
  comparison: '#94A3B8',
} as const;

/**
 * Axis/tick typography. Charts use the sans face at all sizes — the display
 * serif is for page headers and KPI values only and reads as off-brand inside
 * a plot.
 */
export const CHART_TICK = { fontSize: 11, fill: CHART_CHROME.axis } as const;
