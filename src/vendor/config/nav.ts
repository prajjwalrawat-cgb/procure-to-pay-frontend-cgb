import type { TopNavGroup, TopNavItem } from '@/components/ui';

/**
 * Vendor-portal navigation.
 *
 * Ten destinations, so the split is gentler than the buyer side: the seven a
 * supplier works in daily are tabs, and the three account-shaped ones sit
 * under "More". Same two-row top bar, same pill for the current section — a
 * supplier who also buys should not have to learn two products.
 */
export const VENDOR_PRIMARY_NAV: TopNavItem[] = [
  { label: 'Dashboard', href: '/vendor' },
  { label: 'Sourcing', href: '/vendor/sourcing' },
  { label: 'Purchase orders', href: '/vendor/purchase-orders' },
  { label: 'Deliveries', href: '/vendor/receipts' },
  { label: 'Invoices', href: '/vendor/invoices' },
  { label: 'Contracts', href: '/vendor/contracts' },
  { label: 'Returns', href: '/vendor/rma' },
];

export const VENDOR_OVERFLOW_NAV: TopNavGroup[] = [
  {
    heading: 'Your account',
    items: [
      { label: 'Onboarding', href: '/vendor/onboarding' },
      { label: 'Profile', href: '/vendor/profile' },
      { label: 'Documents', href: '/vendor/documents' },
    ],
  },
];

/**
 * Command-palette targets for the vendor portal (⌘K / Ctrl-K).
 *
 * Mirrors the buyer portal's LIVE_ROUTES: only routes that actually render a
 * feature. `/vendor/profile` and `/vendor/documents` are still ComingInSlice
 * placeholders, so they are left out rather than offered as destinations.
 * Keywords cover the words a supplier would reach for, not just the label.
 */
export const VENDOR_LIVE_ROUTES = [
  { label: 'Dashboard', href: '/vendor', keywords: 'home overview supplier' },
  {
    label: 'Onboarding',
    href: '/vendor/onboarding',
    keywords: 'register kyc gst pan bank documents wizard',
  },
  { label: 'Invoices', href: '/vendor/invoices', keywords: 'bill payment ar submitted' },
  {
    label: 'Submit an invoice',
    href: '/vendor/invoices/submit',
    keywords: 'new invoice raise bill upload',
  },
  { label: 'Sourcing', href: '/vendor/sourcing', keywords: 'rfq quote bid tender' },
  {
    label: 'Purchase orders',
    href: '/vendor/purchase-orders',
    keywords: 'po order acknowledge',
  },
  { label: 'Contracts', href: '/vendor/contracts', keywords: 'agreement countersign' },
  {
    label: 'Deliveries',
    href: '/vendor/receipts',
    keywords: 'grn goods receipt dispatch shipment',
  },
  { label: 'Returns', href: '/vendor/rma', keywords: 'rma return rejection credit note' },
];
