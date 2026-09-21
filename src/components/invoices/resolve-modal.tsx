'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui';
import { useState } from 'react';
import type {
  ExceptionResolutionAction,
  InvoiceExceptionView,
} from '@/lib/shared';

import { useResolveException } from '@/lib/api/invoices';
import { useToastStore } from '@/store/toast-store';

const ACTIONS: { key: ExceptionResolutionAction; label: string }[] = [
  { key: 'ACCEPT_VARIANCE', label: 'Accept variance' },
  { key: 'REJECT_LINE', label: 'Reject line' },
  { key: 'DEBIT_NOTE', label: 'Raise debit note' },
  { key: 'QUERY_VENDOR', label: 'Query vendor' },
];

export function ResolveModal({
  invoiceId,
  exception,
  onClose,
}: {
  invoiceId: string;
  exception: InvoiceExceptionView | null;
  onClose: () => void;
}): React.JSX.Element {
  const [action, setAction] = useState<ExceptionResolutionAction>('ACCEPT_VARIANCE');
  const [notes, setNotes] = useState('');
  const resolve = useResolveException(invoiceId);
  const toast = useToastStore((s) => s.push);

  const submit = (): void => {
    if (!exception) return;
    resolve.mutate(
      { excId: exception.id, body: { action, notes: notes || null } },
      {
        onSuccess: () => {
          toast('Exception resolved', 'success');
          setNotes('');
          onClose();
        },
        onError: () => toast('Could not resolve exception', 'error'),
      },
    );
  };

  return (
    <Dialog open={exception !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Resolve exception</DialogTitle>
        <DialogDescription>
          {exception?.type.replace(/_/g, ' ')} — {exception?.message}
        </DialogDescription>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAction(a.key)}
              className={
                'duration-hover rounded-sm border px-3 py-2 text-left text-body-sm font-medium transition-colors ' +
                (action === a.key
                  ? 'border-accent bg-accent-wash text-accent-2'
                  : 'border-line text-text hover:bg-canvas')
              }
            >
              {a.label}
            </button>
          ))}
        </div>

        <label className="text-text mt-4 flex flex-col gap-1 text-caption font-medium">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Reason for this resolution…"
            className="border-line bg-panel focus-visible:ring-accent rounded-sm border px-3 py-2 text-body-sm outline-none focus-visible:ring-2"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={resolve.isPending}
          >
            {resolve.isPending ? 'Saving…' : 'Save resolution'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
