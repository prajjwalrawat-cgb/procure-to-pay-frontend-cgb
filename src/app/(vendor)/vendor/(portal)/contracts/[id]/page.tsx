'use client';

import { Money } from '@/lib/shared';
import { PageHeader, Pill } from '@/components/ui';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { openAuthedAsset } from '@/vendor/lib/api-client';
import { useVendorContract } from '@/vendor/lib/api/contracts';
import { formatDate } from '@/lib/format';

const inr = (v: string): string => Money.of(v || 0).toINR();
const fmt = (iso: string): string => formatDate(iso);

export default function VendorContractDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { data: c, isLoading } = useVendorContract(id);

  if (isLoading || !c) {
    return (
      <p className="py-10 text-center text-[13px] text-muted">
        Loading…
      </p>
    );
  }

  return (
    <div className="max-w-4xl">
      <Link
        href="/vendor/contracts"
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Contracts
      </Link>
      <PageHeader
        title={c.title}
        meta={<Pill variant="info">{c.status.replace(/_/g, ' ')}</Pill>}
        description={
          <span className="font-numeric">
            {c.number}, {fmt(c.validityStart)} → {fmt(c.validityEnd)}
          </span>
        }
        actions={
          <>
            {c.pdfAvailable && (
              <button
                type="button"
                onClick={() => void openAuthedAsset(`/vendor/contracts/${id}/pdf`)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] hover:bg-canvas"
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </button>
            )}
          </>
        }
      />

      <Section title="Rate card">
        <table className="w-full text-[13px]">
          <thead className="border-line border-b text-left text-[12px] text-muted">
            <tr>
              <th className="py-1.5 font-medium">Item / Route</th>
              <th className="py-1.5 font-medium">UOM</th>
              <th className="py-1.5 text-right font-medium">Unit rate</th>
            </tr>
          </thead>
          <tbody>
            {c.rateCards.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="py-1.5">
                  {r.routeOrigin ? `${r.routeOrigin} → ${r.routeDest ?? ''}` : r.itemDesc}
                  {r.rateYear > 1 && (
                    <span className="ml-1 text-[11px] text-faint">
                      Yr{r.rateYear}
                    </span>
                  )}
                </td>
                <td className="py-1.5 text-muted">{r.uom}</td>
                <td className="py-1.5 text-right font-mono">{inr(r.unitRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={`Your fulfilment (${c.callOffs.length} call-offs)`}>
        {c.callOffs.length === 0 ? (
          <p className="text-[13px] text-muted">
            No call-offs against this contract yet.
          </p>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="border-line border-b text-left text-[12px] text-muted">
              <tr>
                <th className="py-1.5 font-medium">PO</th>
                <th className="py-1.5 text-right font-medium">Qty</th>
                <th className="py-1.5 text-right font-medium">Value</th>
                <th className="py-1.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {c.callOffs.map((co) => (
                <tr key={co.id} className="border-b border-line last:border-0">
                  <td className="py-1.5 font-mono">{co.poNumber}</td>
                  <td className="py-1.5 text-right font-mono">{co.qty}</td>
                  <td className="py-1.5 text-right font-mono">{inr(co.value)}</td>
                  <td className="py-1.5 text-muted">{fmt(co.calledOffAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Clauses">
        <div className="space-y-3">
          {c.clauses.map((cl) => (
            <div key={cl.id}>
              <p className="text-[13px] font-medium">{cl.title}</p>
              <p className="text-[12px] text-muted">{cl.contentText}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="mb-4 rounded-lg border border-line bg-white p-4">
      <h2 className="mb-2 text-[13px] font-semibold">{title}</h2>
      {children}
    </div>
  );
}
