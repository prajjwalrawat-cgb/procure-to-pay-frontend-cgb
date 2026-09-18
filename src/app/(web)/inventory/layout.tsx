'use client';

import { SubNav } from '@/components/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** The inventory screens, in the order a warehouse day runs. */
const TABS = [
  { href: '/inventory', label: 'Stock' },
  { href: '/inventory/receive', label: 'Receive & QC' },
  { href: '/inventory/issues', label: 'Internal issues' },
  { href: '/inventory/fulfill', label: 'Fulfil orders' },
  { href: '/inventory/returns', label: 'Returns' },
  { href: '/inventory/adjustments', label: 'Adjustments' },
  { href: '/inventory/ledger', label: 'Ledger' },
  { href: '/inventory/locations', label: 'Locations' },
  { href: '/inventory/boxes', label: 'Boxes' },
  { href: '/inventory/bulk-upload', label: 'Bulk upload' },
];

/**
 * Inventory is the one section deep enough to need its own row of
 * destinations. It uses the same <SubNav> as every per-screen tab row, so the
 * three navigation levels stay visually ranked: filled pill for the section,
 * accent underline for the view, and nothing else competing.
 */
export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();

  // Only "/inventory" needs an exact match; the rest own their subtree.
  const active =
    TABS.find((t) => t.href !== '/inventory' && pathname.startsWith(t.href))?.href ??
    '/inventory';

  return (
    <div>
      <SubNav
        className="mb-5"
        aria-label="Inventory views"
        items={TABS.map((t) => ({ key: t.href, label: t.label, href: t.href }))}
        value={active}
        renderLink={(item, content) => (
          <Link key={item.key} href={item.href ?? '#'}>
            {content}
          </Link>
        )}
      />
      {children}
    </div>
  );
}
