'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Pill,
} from '@/components/ui';
import { Money, type DeliveryAddress, type PaymentTerms } from '@/lib/shared';
import { ArrowLeft, Download, MessageSquarePlus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { rateToPercent } from '@/lib/rate';
import { openAuthedAsset } from '@/vendor/lib/api-client';
import {
  useAcknowledgePo,
  useRaisePoQuery,
  useVendorPo,
} from '@/vendor/lib/api/purchase-orders';
import { useToastStore } from '@/vendor/store/toast-store';

const STATUS_VARIANT: Record<string, 'success' | 'warn' | 'info' | 'gray'> = {
  ISSUED: 'info',
  ACKNOWLEDGED: 'success',
  PARTIALLY_FULFILLED: 'warn',
  FULFILLED: 'success',
  CLOSED: 'success',
  CANCELLED: 'gray',
};

const label = (status: string): string => status.replace(/_/g, ' ');
const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('en-IN') : '—';
const fmtDateTime = (iso: string): string => new Date(iso).toLocaleString('en-IN');
const inr = (v: string): string => Money.of(v || 0).toINR();

function formatAddress(addr: DeliveryAddress | null): string {
  if (!addr) return '—';
  return [
    addr.label,
    addr.line1,
    addr.line2,
    [addr.city, addr.stateCode].filter(Boolean).join(', '),
    addr.pincode,
  ]
    .filter(Boolean)
    .join(', ');
}

function formatPaymentTerms(terms: PaymentTerms | null): string {
  if (!terms) return '—';
  const base = terms.label ?? terms.kind.replace(/_/g, ' ');
  return terms.days != null ? `${base} (${terms.days} days)` : base;
}

export default function VendorPurchaseOrderDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: po, isLoading } = useVendorPo(id);
  const acknowledge = useAcknowledgePo(id);
  const raiseQuery = useRaisePoQuery(id);
  const pushToast = useToastStore((s) => s.push);

  const [queryOpen, setQueryOpen] = useState(false);
  const [queryBody, setQueryBody] = useState('');

  const onAcknowledge = (): void => {
    acknowledge.mutate(undefined, {
      onSuccess: () => pushToast('Purchase order acknowledged.', 'success'),
      // 409 = already acknowledged; onSettled refetch shows the acked state.
      onError: () => pushToast('This purchase order was already acknowledged.', 'info'),
    });
  };

  const onSubmitQuery = (): void => {
    const body = queryBody.trim();
    if (!body) return;
    raiseQuery.mutate(
      { body, s3Keys: [] },
      {
        onSuccess: () => {
          setQueryBody('');
          setQueryOpen(false);
          pushToast('Query sent to the buyer.', 'success');
        },
        onError: (e) =>
          pushToast((e as Error).message || 'Could not send query.', 'error'),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-1 py-10 text-[13px] text-muted">Loading…</div>
    );
  }
  if (!po) {
    return (
      <div className="mx-auto max-w-4xl">
        <BackLink />
        <p className="mt-4 text-[13px] text-muted">Purchase order not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <BackLink />

      {/* Header */}
      <div className="mb-5 mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-numeric text-[20px] font-semibold tracking-heading text-ink">
              {po.number}
            </h1>
            <Pill variant={STATUS_VARIANT[po.status] ?? 'gray'} dot>
              {label(po.status)}
            </Pill>
            {po.acknowledgedAt && (
              <Pill variant="success" dot>
                Acknowledged
              </Pill>
            )}
          </div>
          <p className="mt-1 text-[12px] text-muted">
            Ordered {fmtDate(po.orderedDate)} · Expected{' '}
            {fmtDate(po.expectedDeliveryDate)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {po.pdfAvailable && (
            // A plain link cannot carry the in-memory access token, so the API
            // would 401 — fetch it authenticated and open the blob instead.
            <Button
              variant="default"
              size="sm"
              onClick={() =>
                openAuthedAsset(`/vendor/purchase-orders/${po.id}/pdf`).catch((e) =>
                  pushToast(
                    e instanceof Error ? e.message : 'Could not open the PDF',
                    'error',
                  ),
                )
              }
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
            </Button>
          )}
          <Button variant="default" size="sm" onClick={() => setQueryOpen(true)}>
            <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" /> Raise query
          </Button>
          {po.acknowledgedAt ? (
            <Button variant="ghost" size="sm" disabled>
              Acknowledged
            </Button>
          ) : (
            <Button
              variant="accent"
              size="sm"
              onClick={onAcknowledge}
              disabled={acknowledge.isPending}
            >
              {acknowledge.isPending ? 'Acknowledging…' : 'Acknowledge receipt'}
            </Button>
          )}
        </div>
      </div>

      {po.acknowledgedAt && (
        <div className="mb-5 rounded-sm bg-accent-wash px-3 py-2 text-[12px] text-accent-2">
          You acknowledged this purchase order on {fmtDateTime(po.acknowledgedAt)}.
        </div>
      )}

      {/* Delivery & terms */}
      <section className="mb-4 rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-3 text-[14px] font-semibold text-ink">Delivery &amp; terms</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-3">
          <Field label="Delivery address" value={formatAddress(po.deliveryAddress)} />
          <Field label="Delivery terms" value={po.deliveryTerms ?? '—'} />
          <Field label="Payment terms" value={formatPaymentTerms(po.paymentTerms)} />
        </dl>
      </section>

      {/* Line items */}
      <section className="mb-4 rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-3 text-[14px] font-semibold text-ink">Line items</h2>
        <div className="overflow-hidden rounded-lg border border-line">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-canvas text-left text-[11px] uppercase tracking-wide text-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">HSN</th>
                  <th className="px-3 py-2 font-medium">UOM</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit price</th>
                  <th className="px-3 py-2 text-right font-medium">Tax</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((l) => (
                  <tr key={l.lineNo} className="border-t border-line">
                    <td className="font-numeric px-3 py-2 text-muted">{l.lineNo}</td>
                    <td className="px-3 py-2 text-text">{l.itemDesc}</td>
                    <td className="font-numeric px-3 py-2 text-muted">
                      {l.hsnCode ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-muted">{l.uom}</td>
                    <td className="font-numeric px-3 py-2 text-right text-text">
                      {l.qtyOrdered}
                    </td>
                    <td className="font-numeric px-3 py-2 text-right text-text">
                      {inr(l.unitPrice)}
                    </td>
                    <td className="font-numeric px-3 py-2 text-right text-muted">
                      {rateToPercent(l.taxRate)}%
                    </td>
                    <td className="font-numeric px-3 py-2 text-right text-ink">
                      {inr(l.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="mt-3 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="font-numeric text-text">{inr(po.amounts.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">
                Tax{po.amounts.taxKind ? ` (${po.amounts.taxKind})` : ''}
              </dt>
              <dd className="font-numeric text-text">{inr(po.amounts.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-1.5">
              <dt className="font-semibold text-ink">Total</dt>
              <dd className="font-numeric font-semibold text-ink">
                {inr(po.amounts.total)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Terms & conditions — the same rows printed on the PO PDF. Shown on
          screen because acknowledging the order accepts them, and a supplier
          should not have to open an attachment to find out what they are. */}
      {po.terms.length > 0 && (
        <section className="mb-4 rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-3 text-[14px] font-semibold text-ink">Terms &amp; conditions</h2>
          <ol className="flex flex-col gap-2 text-[13px]">
            {po.terms.map((t, i) => (
              <li key={t.id}>
                <span className="font-medium text-text">
                  {i + 1}. {t.title}
                </span>
                <p className="pl-4 text-[12px] text-muted">{t.contentText}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Queries */}
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-3 text-[14px] font-semibold text-ink">Your queries</h2>
        {po.queries.length === 0 ? (
          <p className="text-[13px] text-muted">
            No queries raised on this purchase order.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {po.queries.map((q) => (
              <li key={q.id} className="rounded-sm border border-line bg-canvas/50 p-3">
                <p className="whitespace-pre-wrap text-[13px] text-text">{q.body}</p>
                <p className="mt-1.5 text-[11px] text-faint">
                  {q.source} · {fmtDateTime(q.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Raise query modal */}
      <Dialog open={queryOpen} onOpenChange={setQueryOpen}>
        <DialogContent>
          <DialogTitle>Raise a query</DialogTitle>
          <DialogDescription>
            Ask the buyer a question about {po.number}. They will see it against this
            purchase order.
          </DialogDescription>
          <textarea
            value={queryBody}
            onChange={(e) => setQueryBody(e.target.value)}
            rows={5}
            placeholder="Type your message…"
            className="mt-4 w-full resize-none rounded-sm border border-line bg-canvas px-3 py-2 text-[13px] text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setQueryOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={onSubmitQuery}
              disabled={queryBody.trim().length === 0 || raiseQuery.isPending}
            >
              {raiseQuery.isPending ? 'Sending…' : 'Send query'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BackLink(): React.JSX.Element {
  return (
    <Link
      href="/vendor/purchase-orders"
      className="inline-flex items-center gap-1 text-[12px] text-muted"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to purchase orders
    </Link>
  );
}

function Field({ label: l, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-faint">{l}</dt>
      <dd className="mt-0.5 text-[13px] text-text">{value}</dd>
    </div>
  );
}
