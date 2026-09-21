'use client';

/**
 * The LedgerStrip, wired to the real audit API.
 *
 * Document detail pages drop in `<DocumentLedger entityType="INVOICE" entityId={id} />`
 * and get the document's tamper-evident history plus a live cryptographic
 * verification, with no per-page plumbing.
 *
 * The verdict is deliberately server-derived. `/audit/verify` recomputes the
 * hash chain; nothing here infers integrity from the filtered list it renders
 * (see the note at the top of ui/components/ledger-strip.tsx for why a local
 * check would produce false breaks on a per-document view).
 */

import { LedgerStrip, type LedgerVerdict } from '@/components/ui';
import * as React from 'react';

import { useAuditLog, verifyChain } from '@/lib/api/audit';
import { useToastStore } from '@/store/toast-store';

export function DocumentLedger({
  entityId,
  title,
  className,
}: {
  /**
   * The document's id. Filtering on the id alone is deliberate: audit rows key
   * `entityType` to the PascalCase Prisma model name ('Invoice',
   * 'PurchaseOrder', …), which does not always match the domain word a page
   * would naturally pass, and a mismatched type filter silently returns an
   * empty ledger — the one failure mode that makes this component lie. Ids are
   * globally unique and prefixed, so the type adds no selectivity anyway.
   */
  entityId: string;
  title?: string;
  className?: string;
}): React.JSX.Element {
  const { data, isLoading } = useAuditLog({ entityId });
  const [verdict, setVerdict] = React.useState<LedgerVerdict>({ state: 'unverified' });
  const toast = useToastStore((s) => s.push);

  const onVerify = React.useCallback(async () => {
    setVerdict({ state: 'verifying' });
    try {
      const res = await verifyChain({});
      if (res.verified) {
        setVerdict({ state: 'intact', eventsChecked: res.eventsChecked });
      } else {
        setVerdict({ state: 'broken', firstBreakAt: res.firstBreakAt });
        toast('Audit chain verification failed — the log has been altered', 'error');
      }
    } catch {
      // A failed verification request is not a failed verification. Falling
      // back to "intact" here would be the single most dangerous bug in this
      // component, so an error returns to the honest unverified state.
      setVerdict({ state: 'unverified' });
      toast('Could not run chain verification', 'error');
    }
  }, [toast]);

  return (
    <LedgerStrip
      events={data?.items ?? []}
      verdict={verdict}
      isLoading={isLoading}
      onVerify={() => void onVerify()}
      auditHref={`/audit?entityId=${encodeURIComponent(entityId)}`}
      title={title}
      className={className}
    />
  );
}
