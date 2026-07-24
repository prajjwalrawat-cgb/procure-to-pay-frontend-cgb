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
