'use client';

import { ErrorState, Skeleton } from '@/components/ui';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { usePoAmendmentTarget } from '@/lib/api/purchase-orders';

/**
 * Approval notifications and the inbox link a PO amendment by its own id.
 * The amendment is reviewed on its PO's page, so forward there.
 */
export default function PoAmendmentRedirect(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, refetch } = usePoAmendmentTarget(id);

  useEffect(() => {
    if (data) router.replace(`/purchase-orders/${data.poId}`);
  }, [data, router]);

  if (error) {
    return (
      <div className="rounded-lg border border-line bg-panel">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }
  return <Skeleton className="h-64 w-full" />;
}
