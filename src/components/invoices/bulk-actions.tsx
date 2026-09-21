'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Textarea,
} from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { apiFetch } from '@/lib/api-client';
import { invoiceKeys } from '@/lib/api/invoices';
import { useTeam } from '@/lib/api/users';

/**
 * Bulk assign / bulk hold for the invoices list.
 *
 * There is no bulk endpoint for either, so these loop the per-invoice routes
 * (`POST /invoices/:id/assign`, `/hold`) one request at a time. Each request is
 * its own transaction, so a failure part-way leaves the earlier invoices done —
 * the result says exactly how many succeeded rather than reporting a blanket
 * success or failure.
 */

export interface BulkResult {
  ok: number;
  failed: { id: string; message: string }[];
}

async function runEach(
  ids: string[],
  call: (id: string) => Promise<unknown>,
): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: [] };
  for (const id of ids) {
    try {
      await call(id);
      result.ok += 1;
    } catch (e) {
      const err = e as { message?: string; title?: string };
      result.failed.push({ id, message: err.message || err.title || 'Request failed' });
    }
  }
  return result;
}

export function summarise(verb: string, r: BulkResult): string {
  if (r.failed.length === 0) return `${verb} ${r.ok} invoice${r.ok === 1 ? '' : 's'}.`;
  const first = r.failed[0]?.message ?? '';
  return `${verb} ${r.ok} of ${r.ok + r.failed.length}. ${r.failed.length} failed: ${first}`;
}

export function BulkAssignDialog({
  ids,
  open,
  onOpenChange,
  onDone,
}: {
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (r: BulkResult) => void;
}): React.JSX.Element {
  const team = useTeam();
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    const r = await runEach(ids, (id) =>
      apiFetch(`/invoices/${id}/assign`, { method: 'POST', body: JSON.stringify({ userId }) }),
    );
    setBusy(false);
    await qc.invalidateQueries({ queryKey: invoiceKeys.all });
    onDone(r);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>
          Assign {ids.length} invoice{ids.length === 1 ? '' : 's'}
        </DialogTitle>
        <DialogDescription className="mt-1">
          The assignee becomes the owner of each invoice and sees it in their queue.
        </DialogDescription>
        <div className="mt-4">
          <label htmlFor="bulk-assignee" className="text-text mb-1.5 block text-caption font-medium">
            Assignee
          </label>
          {team.error ? (
            <p className="text-danger text-body-sm">
              Couldn&apos;t load the team list. Your role may not include viewing users.
            </p>
          ) : (
            <select
              id="bulk-assignee"
              className="w-full"
              value={userId}
              disabled={team.isLoading}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">{team.isLoading ? 'Loading…' : 'Choose a person'}</option>
              {(team.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!userId || busy}>
            {busy ? 'Assigning…' : 'Assign'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BulkHoldDialog({
  ids,
  open,
  onOpenChange,
  onDone,
}: {
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (r: BulkResult) => void;
}): React.JSX.Element {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    const r = await runEach(ids, (id) =>
      apiFetch(`/invoices/${id}/hold`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      }),
    );
    setBusy(false);
    await qc.invalidateQueries({ queryKey: invoiceKeys.all });
    onDone(r);
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>
          Put {ids.length} invoice{ids.length === 1 ? '' : 's'} on hold
        </DialogTitle>
        <DialogDescription className="mt-1">
          Held invoices stay out of payment runs until the hold is released on each one.
        </DialogDescription>
        <div className="mt-4">
          <label htmlFor="bulk-hold-reason" className="text-text mb-1.5 block text-caption font-medium">
            Reason
          </label>
          <Textarea
            id="bulk-hold-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why these invoices are on hold"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!reason.trim() || busy}>
            {busy ? 'Holding…' : 'Put on hold'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
