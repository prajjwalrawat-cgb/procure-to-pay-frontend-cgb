/**
 * Chart tokens — the ProcureFlow instance of the data-viz parameter set.
 *
 * Anchored on the SAP-blue accent: slot 1 is #0A6ED1 so a single-series chart
 * matches the interface around it, the sequential ramp is the accent's own
 * tint scale, and grid/axis pick up the warm `line` and `muted` values.
 *
 * ── Validation (run, not eyeballed) ────────────────────────────────────────
 * dataviz skill's scripts/validate_palette.js, light mode, categorical:
 *
 *   adjacent pairs (bar / column / line / stacked) — all 6 slots PASS
 *     worst CVD ΔE 8.2 (protan, teal↔ochre), worst normal-vision ΔE 21.1
 *
 *   all pairs (pie / scatter / anything where every pair is co-visible)
 *     first 3 slots PASS (worst CVD ΔE 8.2, normal 20.0); adding violet as a
 *     4th fails (violet↔blue ΔE 4.9 deutan)
 *
 * Hence CATEGORICAL_MAX_ALL_PAIRS below. Past three co-visible series, fold to
 * "Other" or switch form — do not add a seventh hue.
 *
 * Re-validate before changing any value here. Ordering is the CVD-safety
 * mechanism, not cosmetic: teal beside rose fails at ΔE 0.7.
 *
 * Status colours are NOT in the categorical set. They are reserved for
 * good/warn/serious/critical and always ship with a label or icon, never
 * colour alone.
 */

/**
 * Categorical series, in fixed order. Never cycle; never generate a 7th.
 *
 * The "one accent" rule governs UI chrome, not data encoding: a chart's whole
 * job is to tell four series apart, and one hue cannot do it. Slot 1 is the
 * app accent so a single-series chart matches the interface around it; the
 * rest are spread wider than the brand palette because a set built only from
 * blues cannot clear the colour-vision gate.
 */
export const CHART_SERIES = [
  '#0A6ED1', // 1 SAP blue — matches the UI accent
  '#C7622A', // 2 ochre
  '#0F8A6A', // 3 teal
  '#9D3FBF', // 4 violet
  '#A8850F', // 5 brass
  '#B4436C', // 6 rose
] as const;

/** Co-visible-pair forms (pie, scatter) may not exceed this many series. */
export const CATEGORICAL_MAX_ALL_PAIRS = 3;

/**
 * Status ramp for compliance state. Distinct from the categorical set and
 * always paired with a text label — never colour alone.
 */
export const CHART_STATUS = {
  good: '#15803D',
  warn: '#F59E0B',
  serious: '#DC2626',
  critical: '#7A1A12',
} as const;

/**
 * Sequential ramp — one hue, light to dark, for magnitude (aging heat, spend
 * intensity). Never a rainbow.
 */
export const CHART_SEQUENTIAL = [
  '#EFF6FF',
  '#D1E8FF',
  '#89C4F4',
  '#4098D7',
  '#0A6ED1',
  '#0854A0',
] as const;

/** Chart chrome, pulled from the app tokens so charts age with the palette. */
export const CHART_CHROME = {
  /** Chart sits on `panel`. The validator was run against this surface. */
  surface: '#FFFFFF',
  /** `line` — recessive gridlines, horizontal only. */
  grid: '#E4DFD1',
  /** `muted` — axis tick labels. */
  axis: '#66625A',
  /** `text` — value labels that must stay readable. */
  label: '#1C1B18',
  /** A prior-period or benchmark series: neutral, never a categorical slot. */
  comparison: '#8A8778',
} as const;

/** Axis/tick typography. Charts use the UI face at all sizes. */
export const CHART_TICK = { fontSize: 11, fill: CHART_CHROME.axis } as const;
