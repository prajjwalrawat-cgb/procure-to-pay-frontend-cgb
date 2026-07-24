import type { NavGroup } from '@procureflow/ui';
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
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Onboarding', href: '/onboarding', icon: ClipboardCheck, slice: 7 },
      { label: 'Invoices', href: '/invoices', icon: ReceiptText, slice: 1 },
      { label: 'Sourcing', href: '/sourcing', icon: Gavel },
      { label: 'Purchase orders', href: '/purchase-orders', icon: FileText },
      { label: 'Contracts', href: '/contracts', icon: ScrollText },
      { label: 'Deliveries', href: '/receipts', icon: PackageCheck },
      { label: 'Returns', href: '/rma', icon: RotateCcw },
      { label: 'Profile', href: '/profile', icon: UserCircle, slice: 7 },
      { label: 'Documents', href: '/documents', icon: FolderClosed, slice: 7 },
    ],
  },
];
