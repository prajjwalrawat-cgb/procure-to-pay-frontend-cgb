'use client';

import { Pill } from '@procureflow/ui';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { useInvoice } from '@/lib/api/invoices';
import { inr, msmeVariant } from '@/lib/format';

/** Inline row expansion: 3-column detail (match / exceptions / MSME clock). */
export function RowDetail({ id }: { id: string }): React.JSX.Element {
  const { data, isLoading } = useInvoice(id);

  if (isLoading || !data) {
    return <div className="text-muted p-4 text-[12px]">Loading detail…</div>;
  }

  const open = data.exceptions.filter((e) => !e.resolved);

  return (
    <div className="bg-canvas grid gap-3 p-4 md:grid-cols-3">
      <div className="border-line bg-panel rounded-lg border p-3">
        <div className="text-faint mb-2 text-[11px] font-semibold uppercase tracking-wide">
          3-way match
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-muted text-[12px]">Variance</span>
          <span className="font-numeric text-danger text-[15px] font-semibold">
            +{inr(data.matchSummary.varianceTotal)}
          </span>
        </div>
        <div className="text-muted mt-1 flex items-center justify-between text-[12px]">
          <span>PO {inr(data.matchSummary.poSubtotal)}</span>
          <span>Inv {inr(data.matchSummary.invoiceSubtotal)}</span>
        </div>
        <Link
          href={`/invoices/${id}`}
          className="text-accent-2 mt-3 inline-flex items-center gap-1 text-[12px] font-medium"
        >
          Open full detail <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="border-line bg-panel rounded-lg border p-3">
        <div className="text-faint mb-2 text-[11px] font-semibold uppercase tracking-wide">
          Exceptions ({open.length})
        </div>
        <ul className="flex flex-col gap-1.5">
          {open.map((e) => (
            <li key={e.id} className="flex items-center justify-between text-[12px]">
              <span className="text-text">{e.type.replace(/_/g, ' ')}</span>
              {e.impactWithTax && (
                <span className="font-numeric text-danger">+{inr(e.impactWithTax)}</span>
              )}
            </li>
          ))}
          {open.length === 0 && (
            <li className="text-muted text-[12px]">No open exceptions.</li>
          )}
        </ul>
        <Link
          href={`/invoices/${id}?exception=1`}
          className="text-accent-2 mt-3 inline-block text-[12px] font-medium"
        >
          Resolve exceptions
        </Link>
      </div>

      <div className="border-line bg-panel rounded-lg border p-3">
        <div className="text-faint mb-2 text-[11px] font-semibold uppercase tracking-wide">
          MSME clock
        </div>
        {data.msme ? (
          <>
            <div className="flex items-center justify-between">
              <Pill variant={msmeVariant(data.msme.bucket)} dot>
                {data.msme.bucket}
              </Pill>
              <span className="font-numeric text-text text-[13px]">
                {data.msme.daysRemaining} days left
              </span>
            </div>
            <div className="bg-canvas mt-2 h-2 w-full overflow-hidden rounded-full">
              <div
                className="from-warn to-danger h-full rounded-full bg-gradient-to-r"
                style={{
                  width: `${Math.max(6, 100 - (data.msme.daysRemaining / 45) * 100)}%`,
                }}
              />
            </div>
          </>
        ) : (
          <div className="text-muted text-[12px]">Not an MSME vendor.</div>
        )}
      </div>
    </div>
  );
}
