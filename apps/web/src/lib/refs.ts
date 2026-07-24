/**
 * Static reference data for Slice 4 pickers — only for enums that have no API
 * endpoint. Cost centres, plants and vendors are now fetched with real
 * tenant-scoped ULIDs via `@/lib/api/refs` (`useCostCenters`/`usePlants`/
 * `useVendors`).
 */

export const PRIORITIES: { value: string; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export const NON_CATALOG_REASONS: { value: string; label: string }[] = [
  { value: 'NEW_PRODUCT', label: 'New product' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'ONE_OFF_SPEND', label: 'One-off spend' },
  { value: 'OTHER', label: 'Other' },
];

export const INCOTERM_OPTIONS: { value: string; label: string }[] = [
  { value: 'EXW', label: 'EXW — Ex Works' },
  { value: 'FOB', label: 'FOB — Free On Board' },
  { value: 'CIF', label: 'CIF — Cost, Insurance & Freight' },
  { value: 'DDP', label: 'DDP — Delivered Duty Paid' },
];

export const PAYMENT_TERM_OPTIONS: {
  value: string;
  label: string;
  days: number | null;
}[] = [
  { value: 'NET_30', label: 'Net 30', days: 30 },
  { value: 'NET_45', label: 'Net 45', days: 45 },
  { value: 'NET_60', label: 'Net 60', days: 60 },
  { value: 'MSME_45', label: 'MSME 45 (§15 cap)', days: 45 },
  { value: 'MILESTONE', label: 'Milestone', days: null },
];

export function priorityVariant(priority: string): 'danger' | 'warn' | 'info' | 'gray' {
  switch (priority) {
    case 'CRITICAL':
      return 'danger';
    case 'HIGH':
      return 'warn';
    case 'STANDARD':
      return 'info';
    default:
      return 'gray';
  }
}
