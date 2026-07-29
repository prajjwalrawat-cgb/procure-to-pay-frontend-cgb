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
};

export type TxnVariant = 'success' | 'danger' | 'warn' | 'info' | 'violet' | 'gray';

export function txnLabel(t: string): string {
  return TXN_LABELS[t] ?? t;
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
      return 'gray';
  }
}

/** Signed quantity as the warehouse reads it: `+12` / `−12`. */
export function formatSignedQty(signedQty: number): string {
  return `${signedQty < 0 ? '−' : '+'}${Math.abs(signedQty).toLocaleString('en-IN')}`;
}
