'use client';

import { Pill } from '@/components/ui';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { useInvoice } from '@/lib/api/invoices';
import { exceptionLabel, impactLabel } from '@/lib/exception-display';
import { inr, msmeVariant } from '@/lib/format';

/** Inline row expansion: 3-column detail (match / exceptions / MSME clock). */
export function RowDetail({ id }: { id: string }): React.JSX.Element {
  const { data, isLoading } = useInvoice(id);

  if (isLoading || !data) {
    return <div className="p-4 text-[12px] text-muted">Loading detail…</div>;
  }

  const open = data.exceptions.filter((e) => !e.resolved);

  return (
    <div className="grid gap-3 bg-canvas p-4 md:grid-cols-3">
      <div className="rounded-lg border border-line bg-panel p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
          3-way match
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-muted">Variance</span>
          <span className="font-numeric text-[15px] font-semibold text-danger">
            +{inr(data.matchSummary.varianceTotal)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
          <span>PO {inr(data.matchSummary.poSubtotal)}</span>
          <span>Inv {inr(data.matchSummary.invoiceSubtotal)}</span>
        </div>
        <Link
          href={`/invoices/${id}`}
          className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-accent-2"
        >
          Open full detail <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="rounded-lg border border-line bg-panel p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
          Exceptions ({open.length})
        </div>
        <ul className="flex flex-col gap-1.5">
          {open.map((e) => (
            <li key={e.id} className="flex items-center justify-between text-[12px]">
              <span className="text-text">{exceptionLabel(e.type)}</span>
              {impactLabel(e.impactWithTax) && (
                <span className="font-numeric text-danger">
                  {impactLabel(e.impactWithTax)}
                </span>
              )}
            </li>
          ))}
          {open.length === 0 && (
            <li className="text-[12px] text-muted">No open exceptions.</li>
          )}
        </ul>
        <Link
          href={`/invoices/${id}?exception=1`}
          className="mt-3 inline-block text-[12px] font-medium text-accent-2"
        >
          Resolve exceptions
        </Link>
      </div>

      <div className="rounded-lg border border-line bg-panel p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
          MSME clock
        </div>
        {data.msme ? (
          <>
            <div className="flex items-center justify-between">
              <Pill variant={msmeVariant(data.msme.bucket)} dot>
                {data.msme.bucket}
              </Pill>
              <span className="font-numeric text-[13px] text-text">
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
          <div className="text-[12px] text-muted">Not an MSME vendor.</div>
        )}
      </div>
    </div>
  );
}
