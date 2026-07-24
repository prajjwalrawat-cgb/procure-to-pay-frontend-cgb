'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@procureflow/ui';
import { useState } from 'react';
import type { VendorPoOption } from '@procureflow/shared';

/**
 * Step 1 of the invoice creation flow: pick an active purchase order. Opens as a
 * modal on the submit page; the form is not shown until Continue is clicked.
 * (ProcureFlow POs have line items rather than Tata-style "service headers", so a
 * single PO selection is all that's needed here.)
 */
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
          <label htmlFor="po-select" className="text-text text-[12px] font-medium">
            PO Number <span className="text-danger">*</span>
          </label>
          <select
            id="po-select"
            aria-label="PO Number"
            value={poId}
            disabled={isLoading}
            onChange={(e) => setPoId(e.target.value)}
            className="border-line bg-panel text-text focus-visible:ring-accent h-9 w-full rounded-sm border px-3 text-[13px] outline-none focus-visible:ring-2 disabled:opacity-50"
          >
            <option value="" disabled>
              {isLoading ? 'Loading your active POs…' : 'Select a purchase order'}
            </option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} · {p.lines.length} line{p.lines.length === 1 ? '' : 's'}
              </option>
            ))}
          </select>
          {!isLoading && options.length === 0 && (
            <p className="text-muted mt-1 text-[12px]">
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
