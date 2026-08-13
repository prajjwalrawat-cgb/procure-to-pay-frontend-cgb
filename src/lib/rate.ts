/**
 * Tax and discount rates travel as **fractions** — `taxRate: '0.18'` means 18%.
 * `computeLineTax` multiplies the subtotal by the rate directly (no /100), and
 * `Item.gstRate` is stored the same way, so anything sent to the API must be a
 * fraction.
 *
 * Buyers read percentages, so forms hold percentages and convert at the edge.
 * Both helpers round to the precision the columns allow — `Decimal(6,4)` for a
 * fraction, i.e. two decimal places once expressed as a percentage — which also
 * clears the float noise in `0.18 * 100`.
 */

/** '0.18' → '18' (for display / form inputs). */
export function rateToPercent(rate: string): string {
  const n = Number(rate);
  if (!Number.isFinite(n)) return rate;
  return String(Math.round(n * 10000) / 100);
}

/** '18' → '0.18' (for the wire). */
export function percentToRate(percent: string): string {
  const n = Number(percent);
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n * 100) / 10000);
}
