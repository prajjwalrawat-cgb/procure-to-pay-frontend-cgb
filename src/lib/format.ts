import { Money } from '@/lib/shared';

/** Display an amount string as INR with lakh grouping. */
export function inr(amount: string | number, fractionDigits = 2): string {
  return Money.of(amount).toINR(fractionDigits);
}

/** Compact INR for large numbers, e.g. "₹1.52 Cr". */
export function inrCompact(amount: string | number): string {
  const n = Number(amount);
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return inr(amount);
}

// ── Dates ───────────────────────────────────────────────────────────────────

/**
 * The app's one date format: dd/mm/yyyy.
 *
 * Not a locale call. `toLocaleDateString('en-IN')` was used on some screens,
 * `toLocaleDateString()` (the *browser's* locale) on others, so the same PO
 * showed 14/08/2026 to one person and 8/14/2026 to another, and two columns on
 * one screen could disagree. A procurement document has a delivery date and a
 * payment due date; ambiguity between them is a real cost, so the format is
 * fixed in code rather than delegated to the machine's settings.
 *
 * Padded to two digits so a column of dates aligns character for character.
 */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** The same date, plus 24-hour time. For audit trails and activity feeds. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hh}:${mi}`;
}

/** Quantities and counts with lakh grouping and no currency symbol. */
export function qty(value: number | string, fractionDigits = 0): string {
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Received',
  OCR_PENDING: 'OCR pending',
  OCR_DONE: 'Matched',
  // The three manual-fallback states. Unlabelled until now, so they rendered
  // as the raw enum name in neutral grey — "OCR_FAILED" reads as a system
  // detail rather than as an invoice sitting in a queue waiting for a person.
  OCR_FAILED: 'OCR failed',
  OCR_LOW_CONFIDENCE: 'Low confidence',
  PENDING_VENDOR_MATCH: 'Unknown sender',
  MATCH_EXCEPTION: 'Exception',
  AWAITING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  HELD: 'Held',
  REJECTED: 'Rejected',
  // Payment-run statuses (Slice 3).
  DRAFT: 'Draft',
  COMPOSED: 'Composed',
  PENDING_APPROVAL: 'Pending approval',
  SUBMITTED: 'Submitted',
  // Was falling through to the raw enum, so the payment-runs list showed
  // "SUBMITTED_PENDING_BANK_CONFIRMATION" in a status pill.
  SUBMITTED_PENDING_BANK_CONFIRMATION: 'Pending bank confirmation',
  SUBMITTED_TO_BANK: 'Submitted to bank',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  // PO / GRN statuses (Slice 4/5).
  ISSUED: 'Issued',
  ACKNOWLEDGED: 'Acknowledged',
  PARTIALLY_RECEIVED: 'Partially received',
  PENDING_QC: 'Pending QC',
  POSTED: 'Posted',
  HOLD: 'Held',
  REVERSED: 'Reversed',
  // GRN qc statuses (Slice 5).
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  PASSED: 'Passed',
  CONDITIONAL_PASS: 'Conditional',
  WAIVED: 'Waived',
  // RMA statuses (Slice 5).
  PICKED_UP: 'Picked up',
  CREDIT_NOTE_RECEIVED: 'Credit note',
  CLOSED: 'Closed',
  // Contract statuses (Slice 9). These were falling through to the raw enum,
  // so the contracts list rendered "EXPIRING_SOON" and "AWAITING_VENDOR_
  // SIGNATURE" at the reader.
  UNDER_NEGOTIATION: 'Under negotiation',
  AWAITING_VENDOR_SIGNATURE: 'Awaiting vendor signature',
  EXPIRING_SOON: 'Expiring soon',
  EXPIRED: 'Expired',
  TERMINATED: 'Terminated',
  SUPERSEDED: 'Superseded',
  // RFQ statuses (Slice 6). Same problem — "Q_AND_A_OPEN" was reaching the
  // sourcing cards verbatim.
  PUBLISHED: 'Published',
  Q_AND_A_OPEN: 'Questions open',
  BIDDING_OPEN: 'Bidding open',
  BID_CLOSED: 'Bidding closed',
  TECH_OPEN: 'Technical bids open',
  COMMERCIAL_OPEN: 'Commercial bids open',
  EVALUATION: 'Under evaluation',
  AWARD_PENDING: 'Award pending',
  AWARDED: 'Awarded',
  // Vendor lifecycle (Slice 7).
  INVITED: 'Invited',
  SELF_REGISTERED: 'Self-registered',
  IN_ONBOARDING: 'In onboarding',
  UNDER_REVIEW: 'Under review',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  BLACKLISTED: 'Blacklisted',
  ARCHIVED: 'Archived',
};

/**
 * Anything the maps above miss, rendered as a sentence rather than as a
 * constant. `PENDING_DISPATCH` → `Pending dispatch`.
 *
 * A backend that adds a status should not be able to put an ALL-CAPS
 * underscored token in front of a user, which is what the previous fallback
 * (`?? status`) allowed.
 */
/**
 * Words this domain never lower-cases. `GST_CERT` → `GST cert`, not `Gst cert`:
 * a procurement screen is full of statutory acronyms, and a lower-cased one
 * reads as a typo to the people who use them all day.
 */
const ACRONYMS = new Set([
  'GST', 'GSTIN', 'GSTR', 'PAN', 'TAN', 'MSME', 'IFSC', 'HSN', 'SAC', 'UOM',
  'PO', 'GRN', 'RFQ', 'RMA', 'QC', 'AQL', 'SLA', 'OTIF', 'IRN', 'TDS', 'IGST',
  'CGST', 'SGST', 'UTR', 'NEFT', 'RTGS', 'IT', 'HR', 'ID', 'URL', 'PDF', 'CSV',
  'OCR', 'API', 'FY', 'FYTD', 'KYC', 'LLP', 'HUF', 'MD', 'CEO', 'CFO',
]);

export function humanise(token: string): string {
  if (!token) return '—';
  // Only rewrite things that actually look like machine constants. Tenant-
  // authored values (vendor categories, cost-centre names) arrive already
  // cased, and lowercasing them turned "IT Services" into "It services".
  if (!/^[A-Z0-9]+(_[A-Z0-9]+)*$/.test(token)) return token;

  const words = token.split('_').map((w, i) => {
    if (ACRONYMS.has(w)) return w;
    const lower = w.toLowerCase();
    return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
  });
  // A leading acronym already carries the capital, so the sentence starts
  // correctly either way.
  return words.join(' ');
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? humanise(status);
}

/**
 * The status palette, reduced to what colour can actually carry.
 *
 * There used to be eight variants here, including violet for "held" and a
 * separate blue for "in flight". Neither is good or bad news — they are just
 * where the record currently is — and giving each its own hue meant a list of
 * forty rows rendered in five colours, none of which the reader could decode
 * without a legend. Three carry meaning; everything else is neutral:
 *
 *   success — done, and done well: approved, paid, posted, passed QC
 *   warn    — stalled, needs a person: awaiting approval, pending QC, low confidence
 *   danger  — failed or rejected: match exception, reversed, failed payment
 *   info    — in flight: submitted, scheduled, being read, partly paid (grey dot)
 *   neutral — drafts, closed, cancelled. No judgement.
 *
 * `<StatusText>` renders these as coloured text with a dot, never as a filled
 * pill — see components/ui/components/pill.tsx.
 */
export type PillVariant = 'success' | 'danger' | 'warn' | 'info' | 'neutral';

export function statusVariant(status: string): PillVariant {
  switch (status) {
    case 'MATCH_EXCEPTION':
    case 'REJECTED':
    case 'FAILED':
    case 'REVERSED':
    case 'EXPIRED':
    case 'TERMINATED':
    case 'BLACKLISTED':
    case 'SUSPENDED':
      return 'danger';
    case 'AWAITING_APPROVAL':
    case 'PENDING_APPROVAL':
    case 'AWAITING_VENDOR_SIGNATURE':
    case 'EXPIRING_SOON':
    case 'AWARD_PENDING':
    case 'UNDER_REVIEW':
    case 'PENDING_QC':
    case 'IN_PROGRESS':
    case 'CONDITIONAL_PASS':
    case 'ISSUED':
    // Stalled rather than in flight: each needs a person before it moves
    // again, unlike OCR_PENDING which clears itself.
    case 'OCR_FAILED':
    case 'OCR_LOW_CONFIDENCE':
    case 'PENDING_VENDOR_MATCH':
    case 'HELD':
    case 'HOLD':
      return 'warn';
    case 'OCR_PENDING':
    case 'RECEIVED':
    case 'SUBMITTED':
    case 'SCHEDULED':
    case 'SUBMITTED_TO_BANK':
    case 'SUBMITTED_PENDING_BANK_CONFIRMATION':
    case 'PARTIALLY_RECEIVED':
    case 'PARTIALLY_PAID':
    case 'ACKNOWLEDGED':
    case 'PICKED_UP':
      return 'info';
    case 'APPROVED':
    case 'PAID':
    case 'OCR_DONE':
    case 'COMPLETED':
    case 'POSTED':
    case 'PASSED':
    case 'CLOSED':
    case 'CREDIT_NOTE_RECEIVED':
    case 'ACTIVE':
    case 'AWARDED':
      return 'success';
    default:
      // Drafts, waived, cancelled, and anything the server adds later.
      return 'neutral';
  }
}

export function msmeVariant(bucket: string): PillVariant {
  return bucket === 'BREACH' ? 'danger' : bucket === 'APPROACHING' ? 'warn' : 'success';
}
