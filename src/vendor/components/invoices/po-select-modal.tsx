'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Select,
} from '@/components/ui';
import { useState } from 'react';
import type { VendorPoOption } from '@/lib/shared';

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
          <label htmlFor="po-select" className="text-caption font-medium text-text">
            Purchase order <span className="text-danger">*</span>
          </label>
          <Select
            id="po-select"
            aria-label="PO Number"
            value={poId}
            disabled={isLoading}
            onChange={(e) => setPoId(e.target.value)}
          >
            <option value="" disabled>
              {isLoading ? 'Loading your active POs…' : 'Select a purchase order'}
            </option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} · {p.lines.length} line{p.lines.length === 1 ? '' : 's'}
              </option>
            ))}
          </Select>
          {!isLoading && options.length === 0 && (
            <p className="mt-1 text-caption text-muted">
              You have no purchase orders left to invoice against. Orders you have already
              billed in full drop off this list — ask your buyer to amend one, or raise a
              new order, if more needs billing.
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={!poId} onClick={proceed}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
