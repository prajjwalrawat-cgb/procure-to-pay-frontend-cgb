'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  PageHeader,
  Pill,
  Skeleton,
  Textarea,
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
import { formatDate, formatDateTime, statusLabel, statusVariant } from '@/lib/format';

const fmtDate = (iso: string | null): string =>
  iso ? formatDate(iso) : '—';
const fmtDateTime = (iso: string): string => formatDateTime(iso);
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
  const { data: po, isLoading, error, refetch } = useVendorPo(id);
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
      <div aria-busy="true" aria-live="polite">
        <BackLink />
        <Skeleton className="h-7 w-44" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        <Skeleton className="mt-6 h-24 rounded-lg" />
        <Skeleton className="mt-4 h-56 rounded-lg" />
      </div>
    );
  }
  if (error || !po) {
    return (
      <div>
        <BackLink />
        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (
          <EmptyState
            title="Purchase order not found"
            detail="It may have been cancelled, or the link is out of date."
          />
        )}
      </div>
    );
  }

  return (
    <div className="pb-10">
      <BackLink />

      {/* Header */}
      <PageHeader
        title={po.number}
        numeric
        meta={
          <>
            <Pill variant={statusVariant(po.status)} dot>
              {statusLabel(po.status)}
            </Pill>
            {po.acknowledgedAt && po.status !== 'ACKNOWLEDGED' && (
              <Pill variant="success" dot>
                Acknowledged
              </Pill>
            )}
          </>
        }
        description={
          <>
            Ordered <span className="font-numeric">{fmtDate(po.orderedDate)}</span>
            {' · '}Expected{' '}
            <span className="font-numeric">{fmtDate(po.expectedDeliveryDate)}</span>
          </>
        }
        actions={
          <>
            {po.pdfAvailable && (
              // A plain link cannot carry the in-memory access token, so the API
              // would 401 — fetch it authenticated and open the blob instead.
              <Button
                variant="secondary"
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
                <Download className="h-3.5 w-3.5" aria-hidden /> Download PDF
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setQueryOpen(true)}>
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden /> Raise query
            </Button>
            {/* Once acknowledged, the status and the banner below say so; a
                disabled "Acknowledged" button beside them was a third copy. */}
            {po.acknowledgedAt ? null : (
              <Button
                variant="primary"
                size="sm"
                onClick={onAcknowledge}
                disabled={acknowledge.isPending}
              >
                {acknowledge.isPending ? 'Acknowledging…' : 'Acknowledge receipt'}
              </Button>
            )}
          </>
        }
      />

      {po.acknowledgedAt && (
        <div className="mb-5 rounded-sm bg-success-bg px-3 py-2 text-caption text-success">
          You acknowledged this purchase order on {fmtDateTime(po.acknowledgedAt)}.
        </div>
      )}

      {/* Delivery & terms */}
      <section className="mb-4 rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-3 text-h3 font-semibold text-ink">Delivery &amp; terms</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Delivery address" value={formatAddress(po.deliveryAddress)} />
          <Field label="Delivery terms" value={po.deliveryTerms ?? '—'} />
          <Field label="Payment terms" value={formatPaymentTerms(po.paymentTerms)} />
        </dl>
      </section>

      {/* Line items */}
      <section className="mb-4 rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-3 text-h3 font-semibold text-ink">Line items</h2>
        <div className="overflow-hidden rounded-lg border border-line">
          <div>
            <table className="pf-stack w-full text-body-sm">
              <thead className="border-line border-b text-left text-caption text-muted">
                <tr>
                  <th className="px-3 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Description</th>
                  <th className="px-3 py-2.5 font-medium">HSN</th>
                  <th className="px-3 py-2.5 font-medium">UOM</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Unit price</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tax</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((l) => (
                  <tr key={l.lineNo} className="border-t border-line">
                    <td className="font-numeric px-3 py-3 text-muted">{l.lineNo}</td>
                    <td className="px-3 py-3 text-text">{l.itemDesc}</td>
                    <td className="font-numeric px-3 py-3 text-muted">
                      {l.hsnCode ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-muted">{l.uom}</td>
                    <td className="font-numeric px-3 py-3 text-right text-text">
                      {l.qtyOrdered}
                    </td>
                    <td className="font-numeric px-3 py-3 text-right text-text">
                      {inr(l.unitPrice)}
                    </td>
                    <td className="font-numeric px-3 py-3 text-right text-muted">
                      {rateToPercent(l.taxRate)}%
                    </td>
                    <td className="font-numeric px-3 py-3 text-right text-ink">
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
          <dl className="w-full max-w-xs space-y-1.5 text-body-sm">
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
          <h2 className="mb-3 text-h3 font-semibold text-ink">Terms &amp; conditions</h2>
          <ol className="flex flex-col gap-2 text-body-sm">
            {po.terms.map((t, i) => (
              <li key={t.id}>
                <span className="font-medium text-text">
                  {i + 1}. {t.title}
                </span>
                <p className="pl-4 text-caption text-muted">{t.contentText}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Queries */}
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-3 text-h3 font-semibold text-ink">Your queries</h2>
        {po.queries.length === 0 ? (
          <EmptyState
            compact
            title="No queries yet"
            detail="Questions you raise with the buyer about this order are kept here."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {po.queries.map((q) => (
              <li key={q.id} className="rounded-sm border border-line bg-canvas/50 p-3">
                <p className="whitespace-pre-wrap text-body-sm text-text">{q.body}</p>
                <p className="mt-1.5 text-micro text-faint">
                  {statusLabel(q.source)} · {fmtDateTime(q.createdAt)}
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
          <Textarea
            value={queryBody}
            onChange={(e) => setQueryBody(e.target.value)}
            rows={5}
            aria-label="Your query"
            placeholder="Type your message…"
            className="mt-4 resize-none"
          />
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setQueryOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
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
      className="mb-3 inline-flex items-center gap-1 text-caption text-muted hover:text-text"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to purchase orders
    </Link>
  );
}

function Field({ label: l, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <dt className="text-micro text-faint">{l}</dt>
      <dd className="mt-0.5 text-body-sm text-text">{value}</dd>
    </div>
  );
}
