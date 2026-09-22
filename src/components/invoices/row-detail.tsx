'use client';

import { ErrorState, Pill, Skeleton } from '@/components/ui';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { useInvoice } from '@/lib/api/invoices';
import { exceptionLabel, impactLabel } from '@/lib/exception-display';
import { inr, msmeVariant, statusLabel } from '@/lib/format';

/** Inline row expansion: 3-column detail (match / exceptions / MSME clock). */
export function RowDetail({ id }: { id: string }): React.JSX.Element {
  const { data, isLoading, error, refetch } = useInvoice(id);

  if (error) {
    return (
      <div className="bg-canvas p-4">
        <ErrorState error={error} onRetry={() => void refetch()} compact />
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="grid gap-3 bg-canvas p-4 md:grid-cols-3" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  const open = data.exceptions.filter((e) => !e.resolved);

  return (
    <div className="grid gap-3 bg-canvas p-4 md:grid-cols-3">
      <div className="rounded-lg border border-line bg-panel p-3">
        <div className="mb-2 text-micro font-semibold text-faint">
          3-way match
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-caption text-muted">Variance</span>
          <span
            className={
              'font-numeric text-h3 font-semibold ' +
              (Number(data.matchSummary.varianceTotal) > 0 ? 'text-danger' : 'text-ink')
            }
          >
            {Number(data.matchSummary.varianceTotal) > 0 ? '+' : ''}
            {inr(data.matchSummary.varianceTotal)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-caption text-muted">
          <span>PO {inr(data.matchSummary.poSubtotal)}</span>
          <span>Inv {inr(data.matchSummary.invoiceSubtotal)}</span>
        </div>
        <Link
          href={`/invoices/${id}`}
          className="mt-3 inline-flex items-center gap-1 text-caption font-medium text-accent hover:underline"
        >
          Open full detail <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="rounded-lg border border-line bg-panel p-3">
        <div className="mb-2 text-micro font-semibold text-faint">
          Exceptions ({open.length})
        </div>
        <ul className="flex flex-col gap-1.5">
          {open.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 text-caption">
              <span className="text-text">{exceptionLabel(e.type)}</span>
              {impactLabel(e.impactWithTax) && (
                <span className="font-numeric text-danger">
                  {impactLabel(e.impactWithTax)}
                </span>
              )}
            </li>
          ))}
          {open.length === 0 && (
            <li className="text-caption text-muted">No open exceptions.</li>
          )}
        </ul>
        <Link
          href={`/invoices/${id}?exception=1`}
          className="mt-3 inline-block text-caption font-medium text-accent hover:underline"
        >
          Resolve exceptions
        </Link>
      </div>

      <div className="rounded-lg border border-line bg-panel p-3">
        <div className="mb-2 text-micro font-semibold text-faint">
          MSME clock
        </div>
        {data.msme ? (
          <>
            <div className="flex items-center justify-between">
              <Pill variant={msmeVariant(data.msme.bucket)} dot>
                {statusLabel(data.msme.bucket)}
              </Pill>
              <span className="font-numeric text-body-sm text-text">
                {data.msme.daysRemaining} days left
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-canvas">
              <div
                className="h-full rounded-full bg-gradient-to-r from-warn to-danger"
                style={{
                  width: `${Math.max(6, 100 - (data.msme.daysRemaining / 45) * 100)}%`,
                }}
              />
            </div>
          </>
        ) : (
          <div className="text-caption text-muted">Not an MSME vendor.</div>
        )}
      </div>
    </div>
  );
}
