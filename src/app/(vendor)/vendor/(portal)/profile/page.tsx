'use client';

import { Button, EmptyState, PageHeader } from '@/components/ui';
import Link from 'next/link';

// Not built as its own screen yet. Rather than a construction placeholder, the
// route says where this information actually lives today.
export default function VendorProfilePage(): React.JSX.Element {
  return (
    <div>
      <PageHeader title="Company profile" />
      <div className="border-line bg-panel rounded-lg border">
        <EmptyState
          title="Your company profile is kept in Onboarding"
          detail="Your company details, GST registrations and bank account are managed in Onboarding, where the buyer reviews every change."
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
