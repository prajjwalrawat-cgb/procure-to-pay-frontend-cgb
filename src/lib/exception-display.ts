import type { ExceptionType } from '@/lib/shared';

import { inr } from './format';

/**
 * Display names for match exceptions. `TYPE.replace(/_/g, ' ')` reads fine for
 * the self-describing ones but turns the newer controls into jargon — "DATE
 * SEQUENCE" and "PO NOT OPEN" tell an AP clerk nothing about what is actually
 * wrong with the document in front of them. Anything absent here falls back to
 * the underscore-stripped type, so a new enum value degrades to readable rather
 * than to blank.
 */
const EXCEPTION_LABEL: Partial<Record<ExceptionType, string>> = {
  RATE_VARIANCE: 'Rate variance',
  QTY_VARIANCE: 'Quantity variance',
  TAX_VARIANCE: 'Tax variance',
  UNAUTHORISED_LINE: 'Line not on PO',
  PO_MISSING: 'No purchase order',
  GRN_MISSING: 'No goods receipt',
  DUPLICATE: 'Duplicate invoice',
  GSTIN_INACTIVE: 'GSTIN not active',
  GSTR2B_MISMATCH: 'GSTR-2B mismatch',
  UOM_MISMATCH: 'Unit of measure',
  DATE_SEQUENCE: 'Date out of sequence',
  PO_NOT_OPEN: 'PO not open for invoicing',
  AMOUNT_MISMATCH: 'Total disagrees with lines',
  VENDOR_BLOCKED: 'Vendor blocked',
};

export function exceptionLabel(type: string): string {
  return EXCEPTION_LABEL[type as ExceptionType] ?? type.replace(/_/g, ' ');
}

/**
 * Signed rupee impact, or null when there is none worth showing.
 *
 * Control failures — no goods receipt, wrong unit of measure, cancelled PO —
 * carry a zero impact by design: their cost is not a price difference. A bare
 * "+₹0.00" beside one reads as "no money at stake" when the honest answer is
 * "this was never priced", so those render nothing at all and let the exception
 * text speak.
 *
 * The sign is the value's own. An invoice that foots BELOW its own lines is a
 * negative variance, and the hardcoded "+" this replaces would have rendered
 * that as "+-₹280.00".
 */
export function impactLabel(impactWithTax: string | null | undefined): string | null {
  if (!impactWithTax) return null;
  const n = Number(impactWithTax);
  if (!Number.isFinite(n) || n === 0) return null;
  return `${n > 0 ? '+' : '-'}${inr(Math.abs(n).toFixed(4))}`;
}
