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

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Received',
  OCR_PENDING: 'OCR pending',
  OCR_DONE: 'Matched',
  MATCH_EXCEPTION: 'Exception',
  AWAITING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  PAID: 'Paid',
  HELD: 'Held',
  REJECTED: 'Rejected',
  // Payment-run statuses (Slice 3).
  DRAFT: 'Draft',
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
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export type PillVariant =
  'success' | 'danger' | 'warn' | 'info' | 'violet' | 'gray' | 'dark' | 'outline';

export function statusVariant(status: string): PillVariant {
  switch (status) {
    case 'MATCH_EXCEPTION':
    case 'REJECTED':
    case 'FAILED':
    case 'REVERSED':
      return 'danger';
    case 'AWAITING_APPROVAL':
    case 'PENDING_QC':
    case 'IN_PROGRESS':
    case 'CONDITIONAL_PASS':
    case 'ISSUED':
      return 'warn';
    case 'OCR_PENDING':
    case 'RECEIVED':
    case 'SUBMITTED_TO_BANK':
    case 'PARTIALLY_RECEIVED':
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
      return 'success';
    case 'HELD':
    case 'HOLD':
    case 'WAIVED':
      return 'violet';
    case 'CANCELLED':
      return 'dark';
    default:
      return 'gray';
  }
}

export function msmeVariant(bucket: string): PillVariant {
  return bucket === 'BREACH' ? 'danger' : bucket === 'APPROACHING' ? 'warn' : 'success';
}
