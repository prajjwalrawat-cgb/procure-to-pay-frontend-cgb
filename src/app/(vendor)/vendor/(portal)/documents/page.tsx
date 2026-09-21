'use client';

import { Button, EmptyState, PageHeader } from '@/components/ui';
import Link from 'next/link';

// Not built as its own screen yet. Rather than a construction placeholder, the
// route says where this information actually lives today.
export default function VendorDocumentsPage(): React.JSX.Element {
  return (
    <div>
      <PageHeader title="Documents" />
      <div className="border-line bg-panel rounded-lg border">
        <EmptyState
          title="Your documents are kept in Onboarding"
          detail="Your registration documents — GST certificate, PAN, cancelled cheque and the rest — are uploaded and kept up to date in Onboarding."
          action={
            <Button asChild variant="primary" size="sm">
              <Link href="/vendor/onboarding">Go to onboarding</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
