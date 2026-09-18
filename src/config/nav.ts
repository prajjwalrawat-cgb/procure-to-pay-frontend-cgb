import type { TopNavGroup, TopNavItem } from '@/components/ui';

/**
 * Buyer-portal navigation.
 *
 * The old navy rail listed all twenty-two destinations at once, grouped under
 * six ALL-CAPS headings. A top nav cannot do that and should not try: a tab row
 * is a claim about what the product is for, so it carries the ten sections a
 * buyer actually moves between during a day, and the rest live one click away
 * under "More".
 *
 * The split is by frequency, not by importance — Settings and Integrations are
 * important and almost never opened mid-task.
 *
 * Sentence case throughout. A nav is a set of labels, not a set of shouts.
 */
export const PRIMARY_NAV: TopNavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Requisitions', href: '/requisitions' },
  { label: 'Sourcing', href: '/sourcing' },
  { label: 'Purchase orders', href: '/purchase-orders' },
  { label: 'Goods receipt', href: '/goods-receipt' },
  { label: 'Inventory', href: '/inventory' },
  { label: 'Invoices', href: '/invoices' },
  { label: 'Payment runs', href: '/payment-runs' },
  { label: 'Vendors', href: '/vendors' },
  { label: 'Contracts', href: '/contracts' },
];

/** Everything else, one click away. Grouped so the menu is scannable. */
export const OVERFLOW_NAV: TopNavGroup[] = [
  {
    heading: 'Work queue',
    items: [
      { label: 'Inbox', href: '/inbox' },
      { label: 'Approval matrix', href: '/approvals' },
      { label: 'Returns (RMA)', href: '/rma' },
    ],
  },
  {
    heading: 'Warehouse',
    items: [
      // Leaves the desktop shell for the phone-sized scanner UI. Listed
      // because a stores officer opening this app on a handset has no other
      // way to find it.
      { label: 'Scanner', href: '/scan' },
      { label: 'Item master', href: '/items' },
    ],
  },
  {
    heading: 'Insights',
    items: [
      { label: 'Analytics', href: '/analytics' },
      { label: 'Audit log', href: '/audit' },
    ],
  },
  {
    heading: 'Administration',
    items: [
      { label: 'Team', href: '/team' },
      { label: 'Integrations', href: '/integrations' },
      { label: 'Settings', href: '/settings' },
    ],
  },
];

/** Flat list of live command-palette routes + actions. */
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
  { label: 'Purchase orders', href: '/purchase-orders', keywords: 'po orders purchase' },
  {
    label: 'New purchase order',
    href: '/purchase-orders/new',
    keywords: 'spot buy direct po without pr requisition quote offline vendor quotation',
  },
  {
    label: 'Goods receipt',
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
    label: 'Scanner',
    href: '/scan',
    keywords:
      'scan barcode qr camera mobile phone handset receive putaway pick cycle count transfer warehouse offline',
  },
  {
    label: 'Bulk upload',
    href: '/inventory/bulk-upload',
    keywords: 'import csv xlsx bulk upload migration product master stock ledger',
  },
  {
    label: 'Stock adjustment',
    href: '/inventory/adjustments',
    keywords:
      'adjust adjustment correct correction fix wrong count stock take shortfall damage write off written off scrap',
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
  {
    label: 'Item master',
    href: '/items',
    keywords: 'item master catalogue catalog sku hsn gst uom material product code',
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
    label: 'Payment runs',
    href: '/payment-runs',
    keywords: 'payments bank neft batch run',
  },
  { label: 'Inbox', href: '/inbox', keywords: 'approvals my queue waiting' },
  { label: 'Approval matrix', href: '/approvals', keywords: 'rules routing matrix' },
  {
    label: 'Analytics',
    href: '/analytics',
    keywords: 'analytics spend savings msme concentration ap performance',
  },
  { label: 'Audit log', href: '/audit', keywords: 'audit trail hash chain' },
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
  { label: 'Vendors', href: '/vendors', keywords: 'supplier vendor master msme' },
  { label: 'Team', href: '/team', keywords: 'users roles people team members' },
  { label: 'Settings', href: '/settings', keywords: 'settings organisation plant gstin' },
];
