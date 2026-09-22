'use client';

import { Money } from '@/lib/shared';
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Pill,
  Skeleton,
} from '@/components/ui';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { openAuthedAsset } from '@/vendor/lib/api-client';
import { useVendorContract } from '@/vendor/lib/api/contracts';
import { formatDate, statusLabel, statusVariant } from '@/lib/format';

const inr = (v: string): string => Money.of(v || 0).toINR();
const fmt = (iso: string): string => formatDate(iso);

function BackLink(): React.JSX.Element {
  return (
    <Link
      href="/vendor/contracts"
      className="text-muted hover:text-text mb-3 inline-flex items-center gap-1 text-caption"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to contracts
    </Link>
  );
}

export default function VendorContractDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { data: c, isLoading, error, refetch } = useVendorContract(id);

  if (error) {
    return (
      <div>
        <BackLink />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }
  if (isLoading || !c) {
    return (
      <div aria-busy="true" aria-live="polite">
        <BackLink />
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="mt-2 h-4 w-56" />
        <Skeleton className="mt-6 h-40 rounded-lg" />
        <Skeleton className="mt-4 h-32 rounded-lg" />
      </div>
    );
  }

  return (
    <div>
      <BackLink />
      <PageHeader
        title={c.title}
        meta={
          <Pill variant={statusVariant(c.status)} dot>
            {statusLabel(c.status)}
          </Pill>
        }
        description={
          <span className="font-numeric">
            {c.number} · {fmt(c.validityStart)} → {fmt(c.validityEnd)}
          </span>
        }
        actions={
          c.pdfAvailable ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void openAuthedAsset(`/vendor/contracts/${id}/pdf`)}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden /> Download PDF
            </Button>
          ) : undefined
        }
      />

      <Section title="Rate card">
        {c.rateCards.length === 0 ? (
          <EmptyState compact title="No rates on this contract" />
        ) : (
          <table className="pf-stack w-full text-body-sm">
            <thead className="border-line border-b text-left text-caption text-muted">
              <tr>
                <th className="py-2.5 pr-3 font-medium">Item / route</th>
                <th className="px-3 py-2.5 font-medium">UOM</th>
                <th className="py-2.5 pl-3 text-right font-medium">Unit rate</th>
              </tr>
            </thead>
            <tbody>
              {c.rateCards.map((r) => (
                <tr key={r.id} className="border-line border-b last:border-0">
                  <td className="text-text py-3 pr-3">
                    {r.routeOrigin ? `${r.routeOrigin} → ${r.routeDest ?? ''}` : r.itemDesc}
                    {r.rateYear > 1 && (
                      <span className="text-faint ml-1.5 text-micro">Year {r.rateYear}</span>
                    )}
                  </td>
                  <td className="text-muted px-3 py-3">{r.uom}</td>
                  <td className="font-numeric py-3 pl-3 text-right">{inr(r.unitRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Your fulfilment"
        count={c.callOffs.length}
      >
        {c.callOffs.length === 0 ? (
          <EmptyState
            compact
            title="No call-offs yet"
            detail="Purchase orders the buyer raises against this contract are listed here."
          />
        ) : (
          <table className="pf-stack w-full text-body-sm">
            <thead className="border-line border-b text-left text-caption text-muted">
              <tr>
                <th className="py-2.5 pr-3 font-medium">PO</th>
                <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                <th className="px-3 py-2.5 text-right font-medium">Value</th>
                <th className="py-2.5 pl-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {c.callOffs.map((co) => (
                <tr key={co.id} className="border-line border-b last:border-0">
                  <td className="font-numeric text-ink py-3 pr-3">{co.poNumber}</td>
                  <td className="font-numeric px-3 py-3 text-right">{co.qty}</td>
                  <td className="font-numeric px-3 py-3 text-right">{inr(co.value)}</td>
                  <td className="font-numeric text-muted py-3 pl-3">{fmt(co.calledOffAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Clauses">
        {c.clauses.length === 0 ? (
          <EmptyState compact title="No clauses recorded" />
        ) : (
          <div className="space-y-4">
            {c.clauses.map((cl) => (
              <div key={cl.id}>
                <p className="text-ink text-body-sm font-medium">{cl.title}</p>
                <p className="text-muted mt-0.5 text-caption leading-relaxed">
                  {cl.contentText}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="border-line bg-panel mb-4 rounded-lg border p-4">
      <h2 className="text-ink mb-2 text-h3 font-semibold">
        {title}
        {count !== undefined && (
          <span className="font-numeric text-muted ml-2 text-body-sm font-normal">{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}
