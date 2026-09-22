'use client';

import type { AnalyticsOverviewResponse } from '@/lib/shared';
import { Card, ErrorState, InfoTip, Skeleton } from '@/components/ui';

import { count, days, money, pct, type Q } from './primitives';

interface Stat {
  label: string;
  value: string;
  help?: string;
}

function stats(d: AnalyticsOverviewResponse): Stat[] {
  return [
    {
      label: 'Spend under management',
      value: money(d.spendUnderManagement),
      help: 'Net invoiced spend in the selected range.',
    },
    { label: 'POs issued', value: count(d.posIssued) },
    {
      label: 'Invoices processed',
      value: count(d.invoicesProcessed),
      help: 'Invoices received in the range, excluding rejected ones.',
    },
    { label: 'Active vendors', value: count(d.activeVendors) },
    {
      label: 'Invoice to pay',
      value: days(d.avgInvoiceToPayDays),
      help: 'Median days from invoice receipt to payment, for invoices paid in the range.',
    },
    {
      label: 'MSME compliance',
      value: pct(d.msmeComplianceScore),
      help: 'Share of MSME invoices due in the last 90 days that were paid by their 45-day due date.',
    },
  ];
}

const LABELS = [
  'Spend under management',
  'POs issued',
  'Invoices processed',
  'Active vendors',
  'Invoice to pay',
  'MSME compliance',
];

/**
 * The six volumetric figures, as one strip rather than six cards: they are a
 * single reading of the period, and a strip keeps them visually distinct from
 * the per-section tiles below. Deliberately no sparklines — this page shows
 * distributions and totals, not trends.
 */
export function OverviewStrip({ query }: { query: Q<AnalyticsOverviewResponse> }): React.JSX.Element {
  if (query.error && !query.data) {
    return (
      <Card>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
      </Card>
    );
  }
  const items: (Stat | null)[] = query.data ? stats(query.data) : LABELS.map(() => null);
  return (
    <Card className="overflow-hidden">
      <dl className="bg-line grid grid-cols-2 gap-px md:grid-cols-3 xl:grid-cols-6">
        {items.map((s, i) => (
          <div key={LABELS[i]} className="bg-panel flex flex-col gap-1.5 px-4 py-3.5">
            <dt className="text-muted flex items-center gap-1.5 text-caption">
              {LABELS[i]}
              {s?.help && (
                <InfoTip content={s.help}>
                  <button
                    type="button"
                    aria-label={`How ${LABELS[i]} is calculated`}
                    className="border-line text-faint hover:text-ink duration-hover flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-micro font-semibold transition-colors"
                  >
                    ?
                  </button>
                </InfoTip>
              )}
            </dt>
            <dd className="text-ink font-numeric text-h1 font-semibold leading-none">
              {s ? s.value : <Skeleton className="h-6 w-24" />}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
