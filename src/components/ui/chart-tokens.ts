/**
 * Chart tokens — the ProcureFlow instance of the data-viz parameter set.
 *
 * Re-anchored on the redesign's single accent: slot 1 is #1B4CE0, the grid and
 * axis pick up the new `line` and `muted` values, and the sequential ramp runs
 * through the accent rather than the retired navy.
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
  '#1B4CE0', // 1 accent blue — matches the UI accent
  '#C7622A', // 2 ochre
  '#0F8A6A', // 3 teal
  '#7C3FD4', // 4 violet
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
  good: '#147A52',
  warn: '#8A5E0E',
  serious: '#B23A31',
  critical: '#7F2019',
} as const;

/**
 * Sequential ramp — one hue, light to dark, for magnitude (aging heat, spend
 * intensity). Never a rainbow.
 */
export const CHART_SEQUENTIAL = [
  '#EAEFFD',
  '#C3D0F7',
  '#8EA5EE',
  '#4C74E6',
  '#1B4CE0',
  '#123297',
] as const;

/** Chart chrome, pulled from the app tokens so charts age with the palette. */
export const CHART_CHROME = {
  /** Chart sits on `panel`. The validator was run against this surface. */
  surface: '#FFFFFF',
  /** `line` — recessive gridlines, horizontal only. */
  grid: '#E3E5E9',
  /** `muted` — axis tick labels. */
  axis: '#6B7078',
  /** `text` — value labels that must stay readable. */
  label: '#1A1D21',
  /** A prior-period or benchmark series: neutral, never a categorical slot. */
  comparison: '#8A8F98',
} as const;

/** Axis/tick typography. Charts use the UI face at all sizes. */
export const CHART_TICK = { fontSize: 11, fill: CHART_CHROME.axis } as const;
