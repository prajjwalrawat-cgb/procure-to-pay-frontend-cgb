/**
 * Presentation for the nine `StockTxnType` values. Lives here rather than in a
 * page so the ledger and the correction banner on the adjustments screen label
 * the same movement identically.
 */
const TXN_LABELS: Record<string, string> = {
  VENDOR_INWARD: 'Vendor inward',
  VENDOR_RETURN_OUT: 'Vendor return',
  SAMPLE_INWARD: 'Sample inward',
  INTERNAL_ISSUE: 'Internal issue',
  INTERNAL_RETURN: 'Internal return',
  CUSTOMER_ORDER_OUT: 'Order out',
  CUSTOMER_RETURN_IN: 'Customer return',
  DAMAGE_WRITE_OFF: 'Damage write-off',
  ADJUSTMENT: 'Adjustment',
  // Scanner moves between sections post as a matched out/in pair.
  TRANSFER_OUT: 'Transfer out',
  TRANSFER_IN: 'Transfer in',
};

export type TxnVariant = 'success' | 'danger' | 'warn' | 'info' | 'neutral';

export function txnLabel(t: string): string {
  // A type added server-side before this map learns it still reads as words,
  // not as a raw SCREAMING_CASE enum.
  return TXN_LABELS[t] ?? t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function txnVariant(t: string): TxnVariant {
  switch (t) {
    case 'VENDOR_INWARD':
    case 'SAMPLE_INWARD':
    case 'INTERNAL_RETURN':
      return 'success';
    case 'CUSTOMER_ORDER_OUT':
    case 'INTERNAL_ISSUE':
      return 'info';
    case 'DAMAGE_WRITE_OFF':
    case 'VENDOR_RETURN_OUT':
      return 'danger';
    case 'CUSTOMER_RETURN_IN':
      return 'warn';
    default:
      return 'neutral';
  }
}

/** Signed quantity as the warehouse reads it: `+12` / `−12`. */
export function formatSignedQty(signedQty: number): string {
  return `${signedQty < 0 ? '−' : '+'}${Math.abs(signedQty).toLocaleString('en-IN')}`;
}
