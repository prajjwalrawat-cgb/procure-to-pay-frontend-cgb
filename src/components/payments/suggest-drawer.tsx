'use client';

import { Button, Pill } from '@/components/ui';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SuggestedInvoice } from '@/lib/shared';

import { useAddPaymentItem, useSuggestInvoices } from '@/lib/api/payments';
import { inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

export function SuggestDrawer({
  runId,
  open,
  onClose,
}: {
  runId: string;
  open: boolean;
  onClose: () => void;
}): React.JSX.Element | null {
  const toast = useToastStore((s) => s.push);
  const suggest = useSuggestInvoices(runId);
  const addItem = useAddPaymentItem(runId);
  const [msmeOnly, setMsmeOnly] = useState(false);
  const [dueWithin, setDueWithin] = useState<number | null>(null);
  const [rows, setRows] = useState<SuggestedInvoice[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [autoCount, setAutoCount] = useState(0);

  const runSuggest = suggest.mutate;
  useEffect(() => {
    if (!open) return;
    runSuggest(
      { msmeOnly, dueWithinDays: dueWithin },
      {
        onSuccess: (res) => {
          setRows(res.items);
          setAutoCount(res.msmeAutoIncludedCount);
          setSelected(
            new Set(res.items.filter((i) => i.autoIncluded).map((i) => i.invoiceId)),
          );
        },
      },
    );
  }, [open, msmeOnly, dueWithin, runSuggest]);

  if (!open) return null;

  const toggle = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addSelected = async (): Promise<void> => {
    const ids = [...selected];
    let added = 0;
    for (const id of ids) {
      const row = rows.find((r) => r.invoiceId === id);
      try {
        await addItem.mutateAsync(id);
        added += 1;
      } catch (e) {
        toast(
          row ? `${row.number}: ${(e as Error).message}` : (e as Error).message,
          'error',
        );
      }
    }
    if (added > 0) toast(`Added ${added} invoice${added === 1 ? '' : 's'}`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="bg-ink/20 absolute inset-0" onClick={onClose} aria-hidden />
      <div className="bg-panel border-line relative flex h-full w-full max-w-md flex-col border-l">
        <div className="border-line flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-ink text-[14px] font-semibold">Add invoices</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-line flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <button
            type="button"
            onClick={() => setMsmeOnly((v) => !v)}
            className={
              'rounded-full border px-2.5 py-1 text-[12px] ' +
              (msmeOnly
                ? 'border-accent bg-accent-wash text-accent-2'
                : 'border-line text-muted')
            }
          >
            MSME only
          </button>
          <button
            type="button"
            onClick={() => setDueWithin((v) => (v === 15 ? null : 15))}
            className={
              'rounded-full border px-2.5 py-1 text-[12px] ' +
              (dueWithin === 15
                ? 'border-accent bg-accent-wash text-accent-2'
                : 'border-line text-muted')
            }
          >
            Due within 15 days
          </button>
        </div>

        {autoCount > 0 && (
          <div className="bg-warn-wash text-warn border-warn/20 border-b px-4 py-2 text-[12px]">
            {autoCount} MSME invoice{autoCount === 1 ? '' : 's'} approaching the 45-day
            cap were auto-selected.
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {suggest.isPending && (
            <div className="text-muted p-4 text-[13px]">Loading…</div>
          )}
          {!suggest.isPending && rows.length === 0 && (
            <div className="text-muted p-4 text-[13px]">No matching invoices.</div>
          )}
          <ul className="divide-line divide-y">
            {rows.map((r) => (
              <li key={r.invoiceId} className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label={`Select ${r.number}`}
                  checked={selected.has(r.invoiceId)}
                  onChange={() => toggle(r.invoiceId)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-numeric text-ink text-[13px] font-medium">
                      {r.number}
                    </span>
                    {r.isMsme && <Pill variant="violet">MSME</Pill>}
                    {!r.bankVerified && <Pill variant="danger">bank unverified</Pill>}
                  </div>
                  <div className="text-muted truncate text-[12px]">{r.vendorName}</div>
                </div>
                <div className="text-right">
                  {/* A part-paid invoice joins the run for only what is left. */}
                  {Number(r.paidAmount) > 0 ? (
                    <>
                      <div className="font-numeric text-[13px] text-ink">
                        {inr(r.outstanding)}
                      </div>
                      <div className="text-[11px] text-info">left of {inr(r.gross)}</div>
                    </>
                  ) : (
                    <div className="font-numeric text-ink text-[13px]">{inr(r.net)}</div>
                  )}
                  {r.msmeDaysRemaining != null && (
                    <div className="text-faint font-numeric text-[11px]">
                      {r.msmeDaysRemaining}d left
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-line flex items-center justify-between border-t px-4 py-3">
          <span className="text-muted text-[12px]">{selected.size} selected</span>
          <Button
            variant="accent"
            size="sm"
            disabled={selected.size === 0 || addItem.isPending}
            onClick={() => void addSelected()}
          >
            Add {selected.size} invoice{selected.size === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </div>
  );
}
