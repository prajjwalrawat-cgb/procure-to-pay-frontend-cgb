import type { PoFulfilment } from '@/lib/shared';

/**
 * Receipt and billing are separate axes and are labelled separately — an order
 * can be fully invoiced with nothing received, and one word hides exactly that.
 * Same wording as the PO detail header, so the list preview and the full page
 * never disagree.
 */
export function receiptLabel(f: PoFulfilment): string {
  if (f.receipt === 'NONE') return 'Not received';
  if (f.receipt === 'COMPLETE') return 'Fully received';
  return `Part received ${f.receivedPct.toFixed(0)}%`;
}

export function billingLabel(f: PoFulfilment): string {
  if (f.billing === 'NONE') return 'Not invoiced';
  if (f.billing === 'OVER') return 'Over-invoiced';
  if (f.billing === 'COMPLETE') return 'Fully invoiced';
  return `Part invoiced ${f.billedPct.toFixed(0)}%`;
}

/** Progress is not good or bad news on its own; only over-billing is a warning. */
export function progressVariant(p: PoFulfilment['billing']): 'neutral' | 'warn' {
  return p === 'OVER' ? 'warn' : 'neutral';
}
