'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  Textarea,
} from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { apiFetch } from '@/lib/api-client';
import { inboxKeys, useBulkApprove } from '@/lib/api/inbox';

/**
 * Bulk approve / bulk reject for the approvals inbox.
 *
 * The two behave differently on failure, and the result each reports says so:
 *
 * - Approve uses `POST /inbox/bulk-approve`. The API runs the whole request in
 *   one database transaction, so a single failure rolls back every approval in
 *   that request. We send the selection in chunks and stop at the first chunk
 *   that fails — chunks before it are committed, the failing chunk is not, and
 *   the rest are never sent. Smaller chunks also keep each request well inside
 *   the API's per-request transaction timeout.
 * - Reject has no bulk endpoint, so it loops `POST /approvals/:id/decide`. Each
 *   call is its own transaction; a failure leaves the others decided.
 */

/** Documents per bulk-approve request. The endpoint accepts up to 100. */
const APPROVE_CHUNK = 25;

export interface BulkApproveOutcome {
  approved: number;
  /** Documents in the chunk that failed — rolled back, still pending. */
  rolledBack: number;
  /** Documents after the failing chunk — never sent, still pending. */
  notAttempted: number;
  error: string | null;
}

export interface BulkRejectOutcome {
  rejected: number;
  failed: { id: string; message: string }[];
}

function messageOf(e: unknown): string {
  const err = e as { message?: string; title?: string; detail?: string };
  return err.message || err.detail || err.title || 'Request failed';
}

/** Every list an approval decision can move a document out of. */
function invalidateAfterDecisions(qc: ReturnType<typeof useQueryClient>): void {
  for (const key of [
    inboxKeys.all,
    ['invoices'],
    ['purchase-orders'],
    ['requisitions'],
    ['payment-runs'],
    ['vendors'],
    ['contracts'],
  ]) {
    void qc.invalidateQueries({ queryKey: key });
  }
}

export function describeApprove(o: BulkApproveOutcome): string {
  const docs = (n: number): string => `${n} document${n === 1 ? '' : 's'}`;
  if (!o.error) return `Approved ${docs(o.approved)}.`;
  const pending = o.rolledBack + o.notAttempted;
  return (
    `Approved ${docs(o.approved)}; ${docs(pending)} still pending. ` +
    `A batch of ${o.rolledBack} failed and was rolled back as a whole: ${o.error}`
  );
}

export function describeReject(o: BulkRejectOutcome): string {
  const total = o.rejected + o.failed.length;
  if (o.failed.length === 0)
    return `Rejected ${o.rejected} document${o.rejected === 1 ? '' : 's'}.`;
  return `Rejected ${o.rejected} of ${total}. ${o.failed.length} failed: ${o.failed[0]?.message ?? ''}`;
}

export function BulkApproveDialog({
  ids,
  open,
  onOpenChange,
  onDone,
}: {
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (o: BulkApproveOutcome) => void;
}): React.JSX.Element {
  const bulk = useBulkApprove();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    const outcome: BulkApproveOutcome = {
      approved: 0,
      rolledBack: 0,
      notAttempted: 0,
      error: null,
    };
    for (let i = 0; i < ids.length; i += APPROVE_CHUNK) {
      const chunk = ids.slice(i, i + APPROVE_CHUNK);
      try {
        const r = await bulk.mutateAsync({
          approvalIds: chunk,
          comment: comment.trim() || undefined,
        });
        outcome.approved += r.approved;
      } catch (e) {
        outcome.rolledBack = chunk.length;
        outcome.notAttempted = ids.length - i - chunk.length;
        outcome.error = messageOf(e);
        break;
      }
    }
    setBusy(false);
    invalidateAfterDecisions(qc);
    setComment('');
    onDone(outcome);
    onOpenChange(false);
  };

  const n = ids.length;
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogTitle>
          Approve {n} document{n === 1 ? '' : 's'}?
        </DialogTitle>
        <DialogDescription className="mt-1">
          Each moves to its next approval step, or is marked approved if yours is the
          last. You are approving without opening them — make sure the list is what
          you expect.
        </DialogDescription>
        <div className="mt-4">
          <Field label="Comment" hint="Optional. Recorded on every approval." htmlFor="bulk-approve-comment">
            <Textarea
              id="bulk-approve-comment"
              rows={3}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy || n === 0}>
            {busy ? 'Approving…' : `Approve ${n}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BulkRejectDialog({
  ids,
  open,
  onOpenChange,
  onDone,
}: {
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (o: BulkRejectOutcome) => void;
}): React.JSX.Element {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    const outcome: BulkRejectOutcome = { rejected: 0, failed: [] };
    // Same route and body as useDecide; called directly so the inbox is
    // refetched once at the end rather than after every document.
    for (const id of ids) {
      try {
        await apiFetch(`/approvals/${id}/decide`, {
          method: 'POST',
          body: JSON.stringify({ decision: 'REJECT', comment: reason.trim() || undefined }),
        });
        outcome.rejected += 1;
      } catch (e) {
        outcome.failed.push({ id, message: messageOf(e) });
      }
    }
    setBusy(false);
    invalidateAfterDecisions(qc);
    setReason('');
    onDone(outcome);
    onOpenChange(false);
  };

  const n = ids.length;
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogTitle>
          Reject {n} document{n === 1 ? '' : 's'}?
        </DialogTitle>
        <DialogDescription className="mt-1">
          Rejection ends the approval for each document — the remaining steps are
          cancelled and the submitter is notified. It cannot be undone.
        </DialogDescription>
        <div className="mt-4">
          {/* The decide schema does not require a comment, so neither do we —
              but a rejection with no reason leaves the submitter guessing. */}
          <Field
            label="Reason"
            hint="Recommended. Recorded on each document's approval history."
            htmlFor="bulk-reject-reason"
          >
            <Textarea
              id="bulk-reject-reason"
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void submit()} disabled={busy || n === 0}>
            {busy ? 'Rejecting…' : `Reject ${n}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
