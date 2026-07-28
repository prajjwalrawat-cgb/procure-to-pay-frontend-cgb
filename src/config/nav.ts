import type { NavGroup } from '@/components/ui';
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileCheck2,
  FileText,
  Gavel,
  LayoutDashboard,
  PackageCheck,
  Plug,
  ReceiptText,
  RotateCcw,
  ScrollText,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';

/**
 * The 15 buyer-portal nav items grouped as in the v6 mockup (Master Context §6).
 * Only Home ('/') is live in Slice 0; every other route renders <ComingInSlice>.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Overview',
    items: [{ label: 'Home', href: '/', icon: LayoutDashboard }],
  },
  {
    heading: 'Procure',
    items: [
      { label: 'Requisitions', href: '/requisitions', icon: ClipboardList, slice: 4 },
      { label: 'Sourcing', href: '/sourcing', icon: Gavel, slice: 6 },
      { label: 'Purchase Orders', href: '/purchase-orders', icon: FileText, slice: 4 },
      { label: 'Goods Receipt', href: '/goods-receipt', icon: PackageCheck },
      { label: 'Returns (RMA)', href: '/rma', icon: RotateCcw },
      { label: 'Inventory', href: '/inventory', icon: Warehouse },
    ],
  },
  {
    heading: 'Pay',
    items: [
      { label: 'Invoices', href: '/invoices', icon: ReceiptText, slice: 1 },
      { label: 'Inbox', href: '/inbox', icon: FileCheck2 },
      { label: 'Payment Runs', href: '/payment-runs', icon: Wallet, slice: 3 },
    ],
  },
  {
    heading: 'Manage',
    items: [
      { label: 'Vendors', href: '/vendors', icon: Truck, slice: 7 },
      { label: 'Contracts', href: '/contracts', icon: ScrollText },
      { label: 'Approval Matrix', href: '/approvals', icon: ShieldCheck },
    ],
  },
  {
    heading: 'Insights',
    items: [
      { label: 'Analytics', href: '/analytics', icon: BarChart3 },
      { label: 'Audit Log', href: '/audit', icon: Boxes },
    ],
  },
  {
    heading: 'System',
    items: [
      { label: 'Team', href: '/team', icon: Users },
      { label: 'Integrations', href: '/integrations', icon: Plug },
      { label: 'Settings', href: '/settings', icon: Settings, slice: 11 },
    ],
  },
];

/** Flat list of live command routes + actions. */
export const LIVE_ROUTES = [
  { label: 'Home', href: '/', keywords: 'dashboard overview' },
  {
    label: 'Requisitions',
    href: '/requisitions',
    keywords: 'pr purchase request requisition board',
  },
  {
    label: 'New requisition',
    href: '/requisitions/new',
    keywords: 'create pr new requisition',
  },
  { label: 'Purchase Orders', href: '/purchase-orders', keywords: 'po orders purchase' },
  {
    label: 'Goods Receipt',
    href: '/goods-receipt',
    keywords: 'grn receipt receive gate qc quality inspection stores',
  },
  {
    label: 'New receipt',
    href: '/goods-receipt/new',
    keywords: 'create grn receive goods gate entry',
  },
  {
    label: 'Returns (RMA)',
    href: '/rma',
    keywords: 'rma return material authorisation credit note',
  },
  {
    label: 'Inventory',
    href: '/inventory',
    keywords: 'stock warehouse sku product location rack on hand low stock',
  },
  {
    label: 'Inventory ledger',
    href: '/inventory/ledger',
    keywords: 'stock ledger movements daily in out vendor inward sales team report',
  },
  {
    label: 'Bulk upload',
    href: '/inventory/bulk-upload',
    keywords: 'import csv xlsx bulk upload migration product master stock ledger',
  },
  {
    label: 'Internal issue',
    href: '/inventory/issues',
    keywords: 'issue photoshoot sales team stock out balance return',
  },
  {
    label: 'Fulfil order',
    href: '/inventory/fulfill',
    keywords: 'dispatch amazon shopify order courier tracking fulfilment',
  },
  { label: 'Invoices', href: '/invoices', keywords: 'invoice bills' },
  {
    label: 'Invoice intake',
    href: '/invoices/intake',
    keywords: 'email intake ocr review dead letter vendor match queue',
  },
  {
    label: 'Integrations',
    href: '/integrations',
    keywords: 'integrations gsp ocr credentials usage cost gstr2b',
  },
  {
    label: 'Payment Runs',
    href: '/payment-runs',
    keywords: 'payments bank neft batch run',
  },
  { label: 'Inbox', href: '/inbox', keywords: 'approvals my queue waiting' },
  { label: 'Approval Matrix', href: '/approvals', keywords: 'rules routing matrix' },
  {
    label: 'Analytics',
    href: '/analytics',
    keywords: 'analytics spend savings msme concentration ap performance',
  },
  { label: 'Audit Log', href: '/audit', keywords: 'audit trail hash chain' },
  {
    label: 'Contracts',
    href: '/contracts',
    keywords: 'contract call-off blanket framework agreement rate card renewal',
  },
  {
    label: 'New contract',
    href: '/contracts/new',
    keywords: 'create contract rate card framework agreement',
  },
  {
    label: 'Renewal calendar',
    href: '/contracts/renewals',
    keywords: 'renewal expiry calendar contract alert',
  },
  {
    label: 'Clause library',
    href: '/contracts/clause-library',
    keywords: 'clause library standard terms legal contract',
  },
];
