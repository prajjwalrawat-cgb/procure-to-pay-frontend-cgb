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
import { useState } from 'react';

import { useRejectInvoice } from '@/lib/api/invoices';
import { useToastStore } from '@/store/toast-store';

/** Matches RejectInvoiceInputSchema on the API. */
const MIN_REASON = 3;

/**
 * Reject an invoice before it reaches approval — a duplicate, the wrong
 * document. The reason is shown to the vendor, so it says what to fix.
 */
export function RejectInvoiceModal({
  invoiceId,
  invoiceNumber,
  open,
  onClose,
}: {
  invoiceId: string;
  invoiceNumber: string;
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const [reason, setReason] = useState('');
  const reject = useRejectInvoice(invoiceId);
  const toast = useToastStore((s) => s.push);
  const valid = reason.trim().length >= MIN_REASON;

  const submit = (): void => {
    if (!valid) return;
    reject.mutate(reason.trim(), {
      onSuccess: () => {
        toast(`${invoiceNumber} rejected`, 'success');
        setReason('');
        onClose();
      },
      onError: (e) => toast((e as Error).message || 'Could not reject this invoice', 'error'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Reject {invoiceNumber}?</DialogTitle>
        <DialogDescription>
          The invoice is closed without going to approval. Its PO quantity is released and
          the vendor can submit a corrected invoice, under the same number if needed. This
          cannot be undone.
        </DialogDescription>

        <Field label="Reason (shown to the vendor)" htmlFor="reject-reason" className="mt-4">
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Duplicate of INV-ZW0GAW, already submitted"
          />
        </Field>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={submit}
            disabled={!valid || reject.isPending}
          >
            {reject.isPending ? 'Rejecting…' : 'Reject invoice'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
