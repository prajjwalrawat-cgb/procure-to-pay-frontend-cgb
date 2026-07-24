import type { ReactNode } from 'react';

import { VendorShell } from '@/components/vendor-shell';

export default function AppGroupLayout({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return <VendorShell>{children}</VendorShell>;
}
