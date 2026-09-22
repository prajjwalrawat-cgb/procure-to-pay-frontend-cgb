'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui';
import { useState } from 'react';

/**
 * A quiet trigger for an irreversible stock action (a write-off posts a ledger
 * entry that can only be offset, never removed). The trigger is an ordinary
 * ghost button; the one red control is the confirm inside the dialog, so the
 * destructive step is always a deliberate second click.
 */
export function ConfirmAction({
  label,
  title,
  detail,
  confirmLabel,
  disabled,
  onConfirm,
}: {
  label: string;
  title: string;
  detail: string;
  confirmLabel: string;
  disabled?: boolean;
  onConfirm: () => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mt-1">{detail}</DialogDescription>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Back
            </Button>
            <Button
              variant="danger"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
