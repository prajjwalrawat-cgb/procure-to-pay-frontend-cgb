import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Print labels — ProcureFlow',
};

/**
 * A bare shell for printable pages.
 *
 * Deliberately outside the app chrome: the top nav and command palette would
 * all land on the paper, and fighting them off with `@media print` rules
 * scattered across shared components is far more fragile than simply not
 * rendering them. These pages are opened in their own tab.
 */
export default function PrintLayout({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return <div className="min-h-screen bg-white">{children}</div>;
}
