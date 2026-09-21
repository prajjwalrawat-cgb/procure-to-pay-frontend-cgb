import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Metadata only: an installed Supplier Portal gets its own name and opens at
 * /vendor rather than at the buyer app's `/`, which would bounce a vendor to
 * the buyer sign-in.
 */
export const metadata: Metadata = {
  manifest: '/vendor.webmanifest',
  appleWebApp: { capable: true, title: 'Supplier Portal', statusBarStyle: 'default' },
};

export default function VendorRootLayout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
