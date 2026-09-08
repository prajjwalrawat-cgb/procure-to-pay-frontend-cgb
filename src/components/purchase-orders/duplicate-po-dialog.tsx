'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Pill,
} from '@/components/ui';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

import type { DuplicatePoMatch } from '@/lib/duplicate-po';
import { inr, statusLabel, statusVariant } from '@/lib/format';

/**
 * The confirm step behind the duplicate-order guard.
 *
 * The server refuses a create whose vendor and lines match a live order raised
 * in the last few days, and hands back the orders it matched. That is a
 * question, not a failure — repeat orders to the same vendor are ordinary, each
 * with its own receipt and invoice — so it is put to the buyer here rather than
 * toasted as an error, and going ahead is one click. The matched orders are
 * linked, because the only way to answer honestly is to open one and look.
 *
 * Going ahead is recorded on the new order's audit trail.
 */
export function DuplicatePoDialog({
  match,
  onCancel,
  onConfirm,
  busy = false,
}: {
  /** null when there is nothing to confirm — the dialog stays closed. */
  match: DuplicatePoMatch | null;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}): React.JSX.Element {
  const duplicates = match?.duplicates ?? [];
  const many = duplicates.length > 1;

  return (
    <Dialog open={match !== null} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warn" />
          {many ? 'Orders like this already exist' : 'This order already exists'}
        </DialogTitle>
        <DialogDescription>
          {many ? 'These orders have' : 'This order has'} the same vendor and the same
          items and quantities, raised in the last {match?.windowDays ?? 7} days. Check{' '}
          {many ? 'them' : 'it'} first — if this is a separate order, go ahead.
        </DialogDescription>

        <ul className="mt-4 divide-y rounded-md border border-line">
          {duplicates.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Link
                  href={`/purchase-orders/${d.id}`}
                  target="_blank"
                  className="text-[13px] font-medium text-accent-2 hover:underline"
                >
                  {d.number}
                </Link>
                <Pill variant={statusVariant(d.status)}>{statusLabel(d.status)}</Pill>
              </div>
              <div className="shrink-0 text-right text-[12px] text-muted">
                <div className="tabular-nums text-text">{inr(d.totalAmount)}</div>
                <div>{new Date(d.createdAt).toLocaleDateString('en-IN')}</div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Go back
          </Button>
          <Button variant="accent" size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? 'Creating…' : 'Raise it anyway'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
