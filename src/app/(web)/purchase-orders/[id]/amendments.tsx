'use client';

import {
  ApprovalChain,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  Input,
  Pill,
  Textarea,
} from '@/components/ui';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { computeDocTax, type PoAmendmentView, type PoDetailResponse } from '@/lib/shared';

import { useAmendPo, useDecidePo } from '@/lib/api/purchase-orders';
import { formatDateTime, inr, qty } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

const AMENDMENT_STATUS: Record<
  PoAmendmentView['status'],
  { label: string; variant: 'warn' | 'success' | 'danger' | 'neutral' }
> = {
  AWAITING_APPROVAL: { label: 'Awaiting approval', variant: 'warn' },
  APPROVED: { label: 'Approved and applied', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  RETURNED: { label: 'Sent back', variant: 'neutral' },
};

const DECIMAL = /^\d+(\.\d+)?$/;

/**
 * Propose new prices/quantities for an approved or issued PO.
 *
 * Nothing on the order changes on submit — the proposal goes to the PO
 * amendment approver, and is written onto the PO only once they approve.
 */
export function AmendDialog({
  po,
  open,
  onClose,
}: {
  po: PoDetailResponse;
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const amend = useAmendPo(po.id);
  const toast = useToastStore((s) => s.push);
  const initial = (): Record<string, { qtyOrdered: string; unitPrice: string }> =>
    Object.fromEntries(
      po.lines.map((l) => [
        l.id,
        { qtyOrdered: trim(l.qtyOrdered), unitPrice: trim(l.unitPrice) },
      ]),
    );
  const [values, setValues] = useState(initial);
  const [reason, setReason] = useState('');

  const close = (): void => {
    setValues(initial());
    setReason('');
    onClose();
  };

  const valid = po.lines.every((l) => {
    const v = values[l.id];
    return (
      !!v &&
      DECIMAL.test(v.qtyOrdered) &&
      DECIMAL.test(v.unitPrice) &&
      Number(v.qtyOrdered) > 0
    );
  });
  const changed = po.lines.filter((l) => {
    const v = values[l.id];
    return (
      !!v &&
      (Number(v.qtyOrdered) !== Number(l.qtyOrdered) ||
        Number(v.unitPrice) !== Number(l.unitPrice))
    );
  });

  // Same GST engine as the server, so the preview matches what gets approved.
  const newTotal = valid
    ? computeDocTax(
        po.lines.map((l) => ({
          qty: values[l.id]!.qtyOrdered,
          unitPrice: values[l.id]!.unitPrice,
          discountPct: l.discountPct,
          taxRate: l.taxRate,
        })),
        { plantStateCode: po.billTo?.stateCode ?? '', vendorGstin: po.vendor.gstin },
      ).total
    : null;

  const onSubmit = (): void => {
    amend.mutate(
      {
        reason: reason.trim(),
        lines: changed.map((l) => ({ lineId: l.id, ...values[l.id]! })),
      },
      {
        onSuccess: () => {
          toast('Amendment sent for approval', 'success');
          close();
        },
        onError: (e) => toast(e instanceof Error ? e.message : 'Failed', 'error'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Amend {po.number}</DialogTitle>
        <DialogDescription className="mt-1">
          The order stays as it is until the change is approved. Once approved, the PO is
          updated
          {po.status === 'APPROVED'
            ? '.'
            : ', a revised PDF is generated and the vendor is asked to acknowledge again.'}
        </DialogDescription>

        <div className="mt-4 overflow-x-auto rounded-md border border-line">
          <table className="w-full text-body-sm">
            <thead className="border-b border-line text-left text-caption text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="w-32 px-3 py-2 text-right font-medium">Quantity</th>
                <th className="w-36 px-3 py-2 text-right font-medium">Unit price (₹)</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l) => {
                const v = values[l.id]!;
                const set = (patch: Partial<typeof v>): void =>
                  setValues((prev) => ({
                    ...prev,
                    [l.id]: { ...prev[l.id]!, ...patch },
                  }));
                return (
                  <tr key={l.id} className="border-t border-line">
                    <td className="px-3 py-2">
                      <div className="text-text">{l.itemDesc}</div>
                      <div className="font-numeric text-micro text-faint">
                        was {qty(l.qtyOrdered, 2)} {l.uom} @ {inr(l.unitPrice)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={v.qtyOrdered}
                        inputMode="decimal"
                        aria-label={`Quantity for ${l.itemDesc}`}
                        onChange={(e) => set({ qtyOrdered: e.target.value })}
                        className="font-numeric text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={v.unitPrice}
                        inputMode="decimal"
                        aria-label={`Unit price for ${l.itemDesc}`}
                        onChange={(e) => set({ unitPrice: e.target.value })}
                        className="font-numeric text-right"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2 text-body-sm">
          <span className="text-muted">Order value</span>
          <span className="font-numeric text-text">{inr(po.amounts.total)}</span>
          <ArrowRight className="h-3.5 w-3.5 text-faint" />
          <span className="font-numeric font-semibold text-ink">
            {newTotal ? inr(newTotal) : '—'}
          </span>
        </div>

        <Field label="Reason for the change" required className="mt-4">
          <Textarea
            rows={2}
            value={reason}
            placeholder="e.g. Die cost is ₹4,200 per vendor PI no. 393"
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={amend.isPending}>
            Back
          </Button>
          <Button
            variant="primary"
            disabled={!valid || changed.length === 0 || !reason.trim() || amend.isPending}
            onClick={onSubmit}
          >
            Send for approval
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Amendment history, with the decision controls for whoever is the approver. */
export function AmendmentsSection({
  po,
}: {
  po: PoDetailResponse;
}): React.JSX.Element | null {
  if (po.amendments.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-h3 font-semibold text-ink">Amendments</h2>
      <div className="flex flex-col gap-3">
        {po.amendments.map((a) => (
          <AmendmentCard key={a.id} poId={po.id} amendment={a} />
        ))}
      </div>
    </section>
  );
}

function AmendmentCard({
  poId,
  amendment: a,
}: {
  poId: string;
  amendment: PoAmendmentView;
}): React.JSX.Element {
  const decide = useDecidePo(poId);
  const toast = useToastStore((s) => s.push);
  const [comment, setComment] = useState('');
  const status = AMENDMENT_STATUS[a.status];

  const onDecide = (decision: 'APPROVE' | 'REJECT'): void => {
    if (!a.myApprovalId) return;
    decide.mutate(
      { approvalId: a.myApprovalId, decision, comment: comment.trim() || null },
      {
        onSuccess: () => {
          toast(
            decision === 'APPROVE'
              ? 'Amendment approved — PO updated'
              : 'Amendment rejected',
            decision === 'APPROVE' ? 'success' : 'error',
          );
          setComment('');
        },
        onError: (e) => toast(e instanceof Error ? e.message : 'Failed', 'error'),
      },
    );
  };

  return (
    <div
      className={
        'rounded-lg border bg-panel p-4 ' +
        (a.status === 'AWAITING_APPROVAL' ? 'border-warn' : 'border-line')
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-body-sm font-semibold text-ink">
          Amendment {a.amendmentNo}
        </div>
        <Pill variant={status.variant} dot>
          {status.label}
        </Pill>
      </div>
      <p className="mt-1 text-body-sm text-text">{a.reason}</p>
      <p className="mt-0.5 text-micro text-faint">
        Requested by {a.requestedByName ?? 'unknown'} · {formatDateTime(a.requestedAt)}
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead className="text-left text-caption text-muted">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Item</th>
              <th className="px-3 py-1.5 text-right font-medium">Quantity</th>
              <th className="py-1.5 pl-3 text-right font-medium">Unit price</th>
            </tr>
          </thead>
          <tbody>
            {a.lineChanges.map((c) => (
              <tr key={c.lineId} className="border-t border-line">
                <td className="py-2 pr-3 text-text">{c.itemDesc}</td>
                <td className="font-numeric px-3 py-2 text-right">
                  <Delta
                    before={qty(c.before.qtyOrdered, 2)}
                    after={qty(c.after.qtyOrdered, 2)}
                  />
                </td>
                <td className="font-numeric py-2 pl-3 text-right">
                  <Delta
                    before={inr(c.before.unitPrice)}
                    after={inr(c.after.unitPrice)}
                  />
                </td>
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="py-2 pr-3 font-medium text-ink">Order value (incl. GST)</td>
              <td />
              <td className="font-numeric py-2 pl-3 text-right font-medium">
                <Delta before={inr(a.beforeTotal)} after={inr(a.afterTotal)} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {a.liveApprovalChain.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <ApprovalChain steps={a.liveApprovalChain} />
        </div>
      )}

      {a.myApprovalId && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment…"
            aria-label="Amendment decision comment"
            className="min-w-[12rem] flex-1"
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={decide.isPending}
            onClick={() => onDecide('REJECT')}
          >
            Reject
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={decide.isPending}
            onClick={() => onDecide('APPROVE')}
          >
            Approve change
          </Button>
        </div>
      )}
    </div>
  );
}

function Delta({ before, after }: { before: string; after: string }): React.JSX.Element {
  if (before === after) return <span className="text-muted">{after}</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-faint line-through">{before}</span>
      <ArrowRight className="h-3 w-3 text-faint" />
      <span className="text-ink">{after}</span>
    </span>
  );
}

/** "5000.0000" → "5000", "7.5000" → "7.5" — what a person would type. */
function trim(v: string): string {
  return v.includes('.') ? v.replace(/\.?0+$/, '') : v;
}
