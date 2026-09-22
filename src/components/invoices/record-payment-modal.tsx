'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@/components/ui';
import { useState } from 'react';
import { MANUAL_PAYMENT_MODES, type ManualPaymentMode } from '@/lib/shared';

import { useRecordPayment } from '@/lib/api/invoices';
import { inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

const MODE_LABELS: Record<ManualPaymentMode, string> = {
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  IMPS: 'IMPS',
  UPI: 'UPI',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
};

const selectCls =
  'flex h-9 w-full rounded-sm border border-line bg-panel px-3 text-body-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent';

/**
 * Record a payment finance made outside the app — a direct transfer or a
 * cheque — against an invoice, in full or in part. Without it a half paid by
 * hand had nowhere to go, and the next payment run paid the whole invoice.
 */
export function RecordPaymentModal({
  invoiceId,
  invoiceNumber,
  grossAmount,
  outstanding,
  remainingTds,
  open,
  onClose,
}: {
  invoiceId: string;
  invoiceNumber: string;
  grossAmount: string;
  /** Still owed, before TDS. */
  outstanding: string;
  /** Invoice TDS not yet withheld by earlier payments. */
  remainingTds: string;
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const record = useRecordPayment(invoiceId);
  const toast = useToastStore((s) => s.push);
  const [amount, setAmount] = useState(outstanding ? Number(outstanding).toFixed(2) : '');
  const [tds, setTds] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [mode, setMode] = useState<ManualPaymentMode>('NEFT');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const owed = Number(outstanding);
  const amt = Number(amount);
  const validAmount = Number.isFinite(amt) && amt > 0 && amt <= owed + 0.005;
  // Mirrors the server's default: a payment clearing the balance takes all the
  // TDS left, a smaller one its proportional share.
  const defaultTds =
    validAmount && Number(remainingTds) > 0
      ? amt >= owed
        ? Number(remainingTds)
        : Math.round(((Number(remainingTds) * amt) / owed) * 100) / 100
      : 0;
  const effectiveTds = tds.trim() === '' ? defaultTds : Number(tds);
  const balanceAfter = validAmount ? Math.max(owed - amt, 0) : owed;

  const setShare = (fraction: number): void => {
    setAmount((Math.round(owed * fraction * 100) / 100).toFixed(2));
  };

  const submit = (): void => {
    setError(null);
    record.mutate(
      {
        amount: Number(amount).toFixed(2),
        tds: tds.trim() === '' ? null : Number(tds).toFixed(2),
        paidAt: new Date(`${paidOn}T12:00:00`).toISOString(),
        mode,
        reference: reference.trim(),
        note: note.trim() || null,
      },
      {
        onSuccess: (res) => {
          toast(
            res.status === 'PAID'
              ? `${invoiceNumber} is now paid in full`
              : `Payment recorded — ${inr(balanceAfter)} still outstanding`,
            'success',
          );
          onClose();
        },
        onError: (e) => setError((e as Error).message || 'Could not record the payment'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>
          For a payment already made outside a payment run, such as a direct bank transfer
          or a cheque. {invoiceNumber} totals {inr(grossAmount)}; {inr(outstanding)} is
          outstanding.
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-3">
          <Field label="Amount paid against the invoice (before TDS)">
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={amount !== '' && !validAmount}
              className="font-numeric"
            />
            <div className="mt-1.5 flex gap-1.5">
              <ShareButton label="Full" onClick={() => setShare(1)} />
              <ShareButton label="50%" onClick={() => setShare(0.5)} />
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Paid on">
              <Input
                type="date"
                value={paidOn}
                max={today()}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </Field>
            <Field label="Mode">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ManualPaymentMode)}
                className={selectCls}
              >
                {MANUAL_PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={mode === 'CHEQUE' ? 'Cheque number' : 'UTR / reference'}>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="font-numeric"
              />
            </Field>
            <Field label="TDS withheld">
              <Input
                inputMode="decimal"
                value={tds}
                onChange={(e) => setTds(e.target.value)}
                placeholder={defaultTds.toFixed(2)}
                className="font-numeric"
              />
            </Field>
          </div>

          <Field label="Note (optional)">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 50% advance agreed with vendor"
            />
          </Field>

          <dl className="rounded-sm bg-canvas px-3 py-2 text-caption">
            <div className="flex justify-between">
              <dt className="text-muted">Net transferred</dt>
              <dd className="font-numeric text-text">
                {inr(validAmount ? Math.max(amt - effectiveTds, 0) : 0)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Outstanding after this</dt>
              <dd className="font-numeric font-semibold text-ink">{inr(balanceAfter)}</dd>
            </div>
          </dl>

          {error && (
            <div className="rounded-sm bg-danger-wash px-3 py-2 text-caption text-danger">
              {error}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={record.isPending || !validAmount || !reference.trim() || !paidOn}
          >
            {record.isPending ? 'Saving…' : 'Record payment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-caption font-medium text-text">
      {label}
      {children}
    </label>
  );
}

function ShareButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xs border border-line px-2 py-0.5 text-micro font-medium text-muted hover:bg-canvas hover:text-text"
    >
      {label}
    </button>
  );
}

/** Today as yyyy-mm-dd in the browser's own time zone. */
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
