'use client';

import { Button, ErrorState, Pill, Skeleton } from '@/components/ui';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { usePurchaseOrder } from '@/lib/api/purchase-orders';
import { inr, qty, statusLabel, statusVariant } from '@/lib/format';

import { billingLabel, progressVariant, receiptLabel } from './fulfilment';

/**
 * Inline row expansion on the PO list: the order's lines with how much of each
 * has been received and invoiced, plus the receipts and invoices raised
 * against it. The list payload carries none of this, so the detail is fetched
 * only when a row is opened — and cached, so re-opening it is instant.
 */
export function PoRowDetail({ id }: { id: string }): React.JSX.Element {
  const { data, isLoading, error, refetch } = usePurchaseOrder(id);

  if (error) {
    return (
      <div className="bg-canvas p-4">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div
        aria-busy="true"
        className="bg-canvas grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_300px]"
      >
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="bg-canvas grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="border-line bg-panel min-w-0 self-start rounded-lg border">
        <h4 className="text-faint px-3 pt-3 text-micro font-semibold">
          Line items ({data.lines.length})
        </h4>
        {/* A nested grid, not pf-stack: on a phone it scrolls sideways inside
            the card rather than exploding each line into its own card. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-body-sm">
            <thead className="text-muted text-left">
              <tr className="border-line border-b">
                <th className="px-3 py-2 text-caption font-medium">Item</th>
                <th className="px-3 py-2 text-right text-caption font-medium">Ordered</th>
                <th className="px-3 py-2 text-right text-caption font-medium">Received</th>
                <th className="px-3 py-2 text-right text-caption font-medium">Invoiced</th>
                <th className="px-3 py-2 text-right text-caption font-medium">Unit price</th>
                <th className="px-3 py-2 text-right text-caption font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l) => {
                const ordered = Number(l.qtyOrdered);
                const received = Number(l.qtyReceived);
                const invoiced = Number(l.qtyInvoiced);
                return (
                  <tr key={l.id} className="border-line border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <span className="font-numeric text-faint mr-1.5 text-caption">
                        {l.lineNo}
                      </span>
                      <span className="text-text">{l.itemDesc}</span>
                    </td>
                    <td className="font-numeric text-text px-3 py-2 text-right whitespace-nowrap">
                      {qty(l.qtyOrdered, 2)}{' '}
                      <span className="text-faint text-caption">{l.uom}</span>
                    </td>
                    <td
                      className={
                        'font-numeric px-3 py-2 text-right ' +
                        (received >= ordered && ordered > 0 ? 'text-success' : 'text-text')
                      }
                    >
                      {qty(l.qtyReceived, 2)}
                    </td>
                    <td
                      className={
                        'font-numeric px-3 py-2 text-right ' +
                        (invoiced > ordered ? 'text-warn font-medium' : 'text-text')
                      }
                    >
                      {qty(l.qtyInvoiced, 2)}
                    </td>
                    <td className="font-numeric text-text px-3 py-2 text-right">
                      {inr(l.unitPrice)}
                    </td>
                    <td className="font-numeric text-ink px-3 py-2 text-right font-medium">
                      {inr(l.lineTotal)}
                    </td>
                  </tr>
                );
              })}
              {data.lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted px-3 py-4 text-caption">
                    This order has no lines yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-line bg-panel flex flex-col gap-3 rounded-lg border p-3">
        <h4 className="text-faint text-micro font-semibold">Receipt &amp; billing</h4>
        <div className="flex flex-col gap-1.5">
          <Progress
            label="Receipt"
            text={receiptLabel(data.fulfilment)}
            variant={progressVariant(data.fulfilment.receipt)}
          />
          <Progress
            label="Billing"
            text={billingLabel(data.fulfilment)}
            variant={progressVariant(data.fulfilment.billing)}
          />
        </div>

        <LinkList
          title="Goods receipts"
          empty="No receipts posted."
          items={data.grnLinks.map((g) => ({
            id: g.id,
            href: `/goods-receipt/${g.id}`,
            number: g.number,
            status: g.qcStatus,
          }))}
        />
        <LinkList
          title="Invoices"
          empty="No invoices raised."
          items={data.invoiceLinks.map((i) => ({
            id: i.id,
            href: `/invoices/${i.id}`,
            number: i.number,
            status: i.status,
          }))}
        />

        <Button asChild variant="link" size="sm" className="mt-auto self-start px-0">
          <Link href={`/purchase-orders/${id}`}>
            Open full order <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      </section>
    </div>
  );
}

function Progress({
  label,
  text,
  variant,
}: {
  label: string;
  text: string;
  variant: 'neutral' | 'warn';
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted text-caption">{label}</span>
      <Pill variant={variant} dot>
        {text}
      </Pill>
    </div>
  );
}

function LinkList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { id: string; href: string; number: string; status: string }[];
}): React.JSX.Element {
  return (
    <div className="border-line border-t pt-2.5">
      <div className="text-muted mb-1 text-caption">{title}</div>
      {items.length === 0 ? (
        <p className="text-faint text-caption">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3">
              <Link
                href={it.href}
                className="font-numeric text-ink hover:text-accent text-body-sm font-medium"
              >
                {it.number}
              </Link>
              <Pill variant={statusVariant(it.status)} dot>
                {statusLabel(it.status)}
              </Pill>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
