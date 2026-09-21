/**
 * Chart tokens — the ProcureFlow instance of the data-viz parameter set.
 *
 * Re-anchored on the emerald accent: slot 1 is #047857 so a single-series
 * chart matches the interface around it, the sequential ramp runs through the
 * accent, and grid/axis pick up the warm `line` and `muted` values.
 *
 * ── Validation (run, not eyeballed) ────────────────────────────────────────
 * dataviz skill's scripts/validate_palette.js, light mode, categorical:
 *
 *   adjacent pairs (bar / column / line / stacked) — all 6 slots PASS
 *     worst CVD ΔE 13.9 (deutan, brass↔rose), worst normal-vision ΔE 21.1
 *
 *   all pairs (pie / scatter / anything where every pair is co-visible)
 *     first 4 slots: normal vision PASS (18.6); CVD in the 6–8 floor band
 *     (ΔE 6.0 protan, emerald↔ochre) — legal only with secondary encoding, so
 *     those forms carry direct labels
 *     slot 5 FAILS (brass↔ochre ΔE 2.4 deutan / 10.4 normal)
 *
 * Hence CATEGORICAL_MAX_ALL_PAIRS below. Past four co-visible series, fold to
 * "Other" or switch form — do not add a seventh hue.
 *
 * Re-validate before changing any value here. Ordering is the CVD-safety
 * mechanism, not cosmetic: emerald beside ochre, or violet beside blue, fails.
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
 * greens cannot clear the colour-vision gate.
 */
export const CHART_SERIES = [
  '#047857', // 1 emerald — matches the UI accent
  '#9D3FBF', // 2 violet
  '#C7622A', // 3 ochre
  '#2563EB', // 4 azure
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
  good: '#15803D',
  warn: '#8A5A0B',
  serious: '#B42318',
  critical: '#7A1A12',
} as const;

/**
 * Sequential ramp — one hue, light to dark, for magnitude (aging heat, spend
 * intensity). Never a rainbow.
 */
export const CHART_SEQUENTIAL = [
  '#E6F4EE',
  '#B7E0CC',
  '#7CC4A3',
  '#34A077',
  '#047857',
  '#034D38',
] as const;

/** Chart chrome, pulled from the app tokens so charts age with the palette. */
export const CHART_CHROME = {
  /** Chart sits on `panel`. The validator was run against this surface. */
  surface: '#FFFFFF',
  /** `line` — recessive gridlines, horizontal only. */
  grid: '#E6E3DC',
  /** `muted` — axis tick labels. */
  axis: '#66625A',
  /** `text` — value labels that must stay readable. */
  label: '#1C1B18',
  /** A prior-period or benchmark series: neutral, never a categorical slot. */
  comparison: '#A19D94',
} as const;

/** Axis/tick typography. Charts use the UI face at all sizes. */
export const CHART_TICK = { fontSize: 11, fill: CHART_CHROME.axis } as const;
