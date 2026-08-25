'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui';
import { useState } from 'react';
import type { VendorPoOption } from '@/lib/shared';

/**
 * Step 1 of the invoice creation flow: pick an active purchase order. Opens as a
 * modal on the submit page; the form is not shown until Continue is clicked.
 * (ProcureFlow POs have line items rather than Tata-style "service headers", so a
 * single PO selection is all that's needed here.)
 */
/**
 * Nothing left to bill on any line. Still offered — a supplier may have a
 * genuine reason to raise one more, and the buyer decides that, not this form —
 * but labelled, so it is not selected by mistake and then found to be an empty
 * form with every quantity at zero.
 */
const fullyBilled = (p: VendorPoOption): boolean =>
  p.lines.length > 0 && p.lines.every((l) => Number(l.qtyBillable) <= 0);

export function PoSelectModal({
  pos,
  isLoading,
  onCancel,
  onContinue,
}: {
  pos: VendorPoOption[] | undefined;
  isLoading: boolean;
  onCancel: () => void;
  onContinue: (po: VendorPoOption) => void;
}): React.JSX.Element {
  const [poId, setPoId] = useState('');
  const options = pos ?? [];

  const proceed = (): void => {
    const selected = options.find((p) => p.id === poId);
    if (selected) onContinue(selected);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-md" hideClose>
        <DialogTitle>Create invoice</DialogTitle>
        <DialogDescription className="mt-1">
          Select an active purchase order to invoice against.
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor="po-select" className="text-[12px] font-medium text-text">
            PO Number <span className="text-danger">*</span>
          </label>
          <select
            id="po-select"
            aria-label="PO Number"
            value={poId}
            disabled={isLoading}
            onChange={(e) => setPoId(e.target.value)}
            className="h-9 w-full rounded-sm border border-line bg-panel px-3 text-[13px] text-text outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            <option value="" disabled>
              {isLoading ? 'Loading your active POs…' : 'Select a purchase order'}
            </option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} · {p.lines.length} line{p.lines.length === 1 ? '' : 's'}
                {fullyBilled(p) ? ' · fully invoiced' : ''}
              </option>
            ))}
          </select>
          {!isLoading && options.length === 0 && (
            <p className="mt-1 text-[12px] text-muted">
              You have no active purchase orders to invoice against.
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="accent" size="sm" disabled={!poId} onClick={proceed}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
