'use client';

import type { MsmeComplianceResponse } from '@/lib/shared';
import { KpiCard } from '@/components/ui';
import Link from 'next/link';

import { inr } from '@/lib/format';

import {
  BarList,
  Panel,
  PanelRow,
  Section,
  TileError,
  TileRow,
  count,
  pct,
  money,
  type BarDatum,
  type Q,
} from './primitives';

type BucketKey = MsmeComplianceResponse['buckets'][number]['key'];

/**
 * Buckets wear the platform's one severity scale — grey within terms, amber
 * approaching the cap, red past it — and every bar is labelled, so the colour
 * is never the only thing saying which bucket is which.
 */
const BUCKET_BAR: Record<BucketKey, string> = {
  '0_29': 'bg-info-solid',
  '30_44': 'bg-warn-solid',
  '45_59': 'bg-danger-solid',
  '60_plus': 'bg-danger-solid',
};

const BUCKET_ORDER: BucketKey[] = ['0_29', '30_44', '45_59', '60_plus'];

export function bucketBars(d: MsmeComplianceResponse | undefined): BarDatum[] {
  const byKey = new Map((d?.buckets ?? []).map((b) => [b.key, b]));
  return BUCKET_ORDER.flatMap((key) => {
    const b = byKey.get(key);
    if (!b) return [];
    return [
      {
        key,
        label: b.label,
        value: Number(b.amount),
        display: money(b.amount),
        secondary: `${count(b.count)} inv`,
        barClass: BUCKET_BAR[key],
        tip: (
          <>
            <span className="font-medium">{b.label}</span>: {inr(b.amount)} outstanding across{' '}
            {count(b.count)} invoice{b.count === 1 ? '' : 's'}
          </>
        ),
      },
    ];
  });
}

export function MsmeComplianceSection({
  query,
}: {
  query: Q<MsmeComplianceResponse>;
}): React.JSX.Element {
  const d = query.data;
  const bars = bucketBars(d);
  const hasOverdue = !!d && d.overdueCount > 0;

  return (
    <Section
      id="msme"
      title="MSME compliance"
      description="What is owed to MSME suppliers today against the 45-day limit — a live snapshot, not affected by the date range."
    >
      <TileRow>
        <KpiCard
          label="Overdue exposure"
          isLoading={query.isLoading}
          value={
            <span className={hasOverdue ? 'text-danger' : undefined}>
              {d ? money(d.overdueExposure) : '—'}
            </span>
          }
          footnote={
            d ? `${count(d.overdueCount)} invoice${d.overdueCount === 1 ? '' : 's'} past 45 days` : undefined
          }
          help="Outstanding balance on MSME invoices already past their 45-day due date."
        />
        <KpiCard
          label="Compliance score"
          isLoading={query.isLoading}
          value={d ? pct(d.complianceScore) : '—'}
          footnote={d ? 'Paid on time, last 90 days' : undefined}
          help="Share of MSME invoices due in the last 90 days that were paid by their 45-day due date."
        />
        <KpiCard
          label="Approaching the limit"
          isLoading={query.isLoading}
          value={d ? count(d.approachingCount) : '—'}
          footnote={d ? 'Due within 7 days' : undefined}
          help="Outstanding MSME invoices whose 45-day due date falls in the next 7 days."
        />
        <KpiCard
          label="Total MSME exposure"
          isLoading={query.isLoading}
          value={d ? money(d.totalExposure) : '—'}
          footnote={d ? 'All outstanding MSME payables' : undefined}
        />
      </TileRow>
      <TileError query={query} what="the MSME figures" />
      <PanelRow>
        <Panel
          title="Outstanding by age"
          meta="Days since invoice date."
          aside={
            <Link href="/analytics/msme" className="text-accent text-caption hover:underline">
              MSME detail
            </Link>
          }
          query={query}
          isEmpty={bars.every((b) => b.value === 0)}
          empty={{ title: 'Nothing outstanding', detail: 'No unpaid MSME invoices right now.' }}
        >
          <BarList data={bars} ariaLabel="Outstanding MSME balance by age" />
        </Panel>
        <Panel
          title="Most at risk"
          meta="Most overdue first."
          query={query}
          isEmpty={(d?.atRisk ?? []).length === 0}
          empty={{ title: 'Nothing overdue', detail: 'No MSME invoice is past its due date.' }}
        >
          <ul className="flex flex-col">
            {(d?.atRisk ?? []).slice(0, 5).map((r) => (
              <li key={r.invoiceId} className="border-line border-b last:border-0">
                <Link
                  href={`/invoices/${r.invoiceId}`}
                  className="hover:bg-canvas duration-hover -mx-1.5 flex min-h-11 items-center justify-between gap-3 rounded-xs px-1.5 py-1.5 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="text-text block truncate text-body-sm font-medium">
                      {r.vendorName}
                    </span>
                    <span className="text-muted font-numeric block text-caption">
                      {r.invoiceNumber}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="text-ink font-numeric block text-body-sm font-medium">
                      {money(r.outstanding)}
                    </span>
                    <span className="text-danger font-numeric block text-caption">
                      {count(r.daysOverdue)} {r.daysOverdue === 1 ? 'day' : 'days'} overdue
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </PanelRow>
    </Section>
  );
}
