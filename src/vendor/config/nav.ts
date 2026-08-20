import type { NavGroup } from '@/components/ui';
import {
  ClipboardCheck,
  FileText,
  FolderClosed,
  Gavel,
  LayoutDashboard,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ScrollText,
  UserCircle,
} from 'lucide-react';

/** Vendor-portal sidebar (Master Context Slice 0). Dashboard is the landing
 *  shell; the rest render <ComingInSlice> until their slice ships. */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', href: '/vendor', icon: LayoutDashboard },
      { label: 'Onboarding', href: '/vendor/onboarding', icon: ClipboardCheck, slice: 7 },
      { label: 'Invoices', href: '/vendor/invoices', icon: ReceiptText, slice: 1 },
      { label: 'Sourcing', href: '/vendor/sourcing', icon: Gavel },
      { label: 'Purchase orders', href: '/vendor/purchase-orders', icon: FileText },
      { label: 'Contracts', href: '/vendor/contracts', icon: ScrollText },
      { label: 'Deliveries', href: '/vendor/receipts', icon: PackageCheck },
      { label: 'Returns', href: '/vendor/rma', icon: RotateCcw },
      { label: 'Profile', href: '/vendor/profile', icon: UserCircle, slice: 7 },
      { label: 'Documents', href: '/vendor/documents', icon: FolderClosed, slice: 7 },
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
