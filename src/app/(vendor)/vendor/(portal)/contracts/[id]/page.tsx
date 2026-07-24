'use client';

import { Money } from '@/lib/shared';
import { Pill } from '@/components/ui';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { openAuthedAsset } from '@/vendor/lib/api-client';
import { useVendorContract } from '@/vendor/lib/api/contracts';

const inr = (v: string): string => Money.of(v || 0).toINR();
const fmt = (iso: string): string => new Date(iso).toLocaleDateString('en-IN');

export default function VendorContractDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { data: c, isLoading } = useVendorContract(id);

  if (isLoading || !c) {
    return (
      <p className="mx-auto max-w-4xl py-10 text-center text-[13px] text-neutral-500">
        Loading…
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/vendor/contracts"
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-neutral-500"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Contracts
      </Link>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold tracking-tight">{c.title}</h1>
            <Pill variant="info">{c.status.replace(/_/g, ' ')}</Pill>
          </div>
          <p className="font-mono text-[13px] text-neutral-500">
            {c.number} · {fmt(c.validityStart)} → {fmt(c.validityEnd)}
          </p>
        </div>
        {c.pdfAvailable && (
          <button
            type="button"
            onClick={() => void openAuthedAsset(`/vendor/contracts/${id}/pdf`)}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-[13px] hover:bg-neutral-50"
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
        )}
      </div>

      <Section title="Rate card">
        <table className="w-full text-[13px]">
          <thead className="border-b border-neutral-200 text-left text-[12px] text-neutral-500">
            <tr>
              <th className="py-1.5 font-medium">Item / Route</th>
              <th className="py-1.5 font-medium">UOM</th>
              <th className="py-1.5 text-right font-medium">Unit rate</th>
            </tr>
          </thead>
          <tbody>
            {c.rateCards.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100 last:border-0">
                <td className="py-1.5">
                  {r.routeOrigin ? `${r.routeOrigin} → ${r.routeDest ?? ''}` : r.itemDesc}
                  {r.rateYear > 1 && (
                    <span className="ml-1 text-[11px] text-neutral-400">
                      Yr{r.rateYear}
                    </span>
                  )}
                </td>
                <td className="py-1.5 text-neutral-500">{r.uom}</td>
                <td className="py-1.5 text-right font-mono">{inr(r.unitRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={`Your fulfilment (${c.callOffs.length} call-offs)`}>
        {c.callOffs.length === 0 ? (
          <p className="text-[13px] text-neutral-500">
            No call-offs against this contract yet.
          </p>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="border-b border-neutral-200 text-left text-[12px] text-neutral-500">
              <tr>
                <th className="py-1.5 font-medium">PO</th>
                <th className="py-1.5 text-right font-medium">Qty</th>
                <th className="py-1.5 text-right font-medium">Value</th>
                <th className="py-1.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {c.callOffs.map((co) => (
                <tr key={co.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-1.5 font-mono">{co.poNumber}</td>
                  <td className="py-1.5 text-right font-mono">{co.qty}</td>
                  <td className="py-1.5 text-right font-mono">{inr(co.value)}</td>
                  <td className="py-1.5 text-neutral-500">{fmt(co.calledOffAt)}</td>
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
              <p className="text-[12px] text-neutral-500">{cl.contentText}</p>
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
    <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-2 text-[13px] font-semibold">{title}</h2>
      {children}
    </div>
  );
}
