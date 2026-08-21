'use client';

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

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();

  return (
    <div>
      <nav className="border-line mb-5 flex flex-wrap items-center gap-1 border-b">
        {TABS.map((t) => {
          // Only "/inventory" needs an exact match; the rest are prefix routes.
          const active = t.href === '/inventory' ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={
                'border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ' +
                (active
                  ? 'border-accent text-ink'
                  : 'text-muted hover:text-ink border-transparent')
              }
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
