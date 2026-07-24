import type { ReactNode } from 'react';

import { Toaster } from '@/vendor/components/toaster';
import { VendorShell } from '@/vendor/components/vendor-shell';

export default function VendorGroupLayout({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <VendorShell>
      {children}
      {/* Vendor-zone toaster: reads the vendor toast store (separate from the
          buyer toaster rendered in the root providers). */}
      <Toaster />
    </VendorShell>
  );
}
