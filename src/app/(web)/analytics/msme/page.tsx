'use client';

import type { AnalyticsPeriodKey, MsmeBucket, MsmeBucketKey } from '@/lib/shared';
import {
  Button,
  CHART_CHROME,
  CHART_STATUS,
  CHART_TICK,
  DataState,
  KpiCard,
  PageHeader,
  Pill,
  TableState,
} from '@/components/ui';
import { AlertTriangle, Download } from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  useMsmeDashboard,
  useMsmeExposure,
  useMsmeTrend,
} from '@/lib/api/analytics';
import { openAuthedAsset } from '@/lib/api-client';
import { inr, inrCompact } from '@/lib/format';

import { AsOfBadge, MSME_BUCKET as BUCKET, MSME_BUCKET_ORDER as BUCKET_ORDER } from '../_lib';

const PILL: Record<keyof typeof CHART_STATUS, 'success' | 'warn' | 'danger'> = {
  good: 'success',
  warn: 'warn',
  serious: 'danger',
  critical: 'danger',
};

export default function MsmePage(): React.JSX.Element {
  const period: AnalyticsPeriodKey = 'LAST_12M';
  const dash = useMsmeDashboard();
  const trend = useMsmeTrend(period);
  // Default to the bucket that costs money. Previously nothing was selected,
  // so the page opened with its most important table hidden.
  const [bucket, setBucket] = useState<MsmeBucketKey>('BREACH_45_PLUS');
  const exposure = useMsmeExposure(bucket);

  const trendPoints = trend.data?.points ?? [];
  const trendIsEmpty =
    trendPoints.length === 0 ||
    trendPoints.every((pt) => Number(pt.breachExposure) === 0);

  const buckets = BUCKET_ORDER.map((key) =>
    dash.data?.buckets.find((b) => b.bucket === key),
  ).filter((b): b is MsmeBucket => Boolean(b));

  const totalExposure = buckets.reduce((n, b) => n + Number(b.totalExposure), 0);
  const breach = buckets.find((b) => b.bucket === 'BREACH_45_PLUS');
  const breaching = (breach?.invoiceCount ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="MSME §15 compliance"
        breadcrumbs={[{ label: 'Analytics', href: '/analytics' }, { label: 'MSME §15' }]}
        description="MSMED Act 2006 §15 caps payment to a registered micro or small enterprise at 45 days. Past that, §16 interest accrues at three times the RBI bank rate."
        meta={
          breaching ? (
            <Pill variant="danger" dot>
              {breach?.invoiceCount} in breach
            </Pill>
          ) : (
            <Pill variant="success" dot>
              No breaches
            </Pill>
          )
        }
        actions={
          <Button
            variant="default"
            size="sm"
            onClick={() => void openAuthedAsset('/analytics/msme/report.pdf')}
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> Compliance report
          </Button>
        }
      />

      {/* The three figures a finance head is accountable for. */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Interest exposure"
          value={exposure.data ? inr(exposure.data.totalInterest) : '—'}
          isLoading={exposure.isLoading}
          footnote="if unpaid today"
          help="Estimated §16 interest on invoices already past the 45-day cap. An estimate, not a posted liability."
        />
        <KpiCard
          label="Payable past the cap"
          value={breach ? inrCompact(breach.totalExposure) : '—'}
          isLoading={dash.isLoading}
          footnote={`${breach?.invoiceCount ?? 0} invoice${breach?.invoiceCount === 1 ? '' : 's'}`}
        />
        <KpiCard
          label="MSME share of spend"
          value={dash.data ? `${dash.data.msmeSpendPct}%` : '—'}
          isLoading={dash.isLoading}
          footnote={dash.data ? `${inrCompact(dash.data.msmeSpendNet)} of net spend` : ''}
          help="Net MSME spend as a share of total net spend over the period."
        />
      </div>

      {/* ── The §15 clock ──────────────────────────────────────────────────
          One bar, because the three buckets are parts of a single payable and
          the question is how much of it is drifting toward the cliff. Three
          separate stat cards could not show that proportion. Status colours,
          each with its own label — never colour alone. */}
      <section className="border-line bg-panel mb-4 rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-ink text-[14px] font-semibold">
            MSME payable against the 45-day cap
          </h2>
          <AsOfBadge refreshedAt={dash.data?.asOfDate ?? null} />
        </div>

        <DataState
          isLoading={dash.isLoading}
          error={dash.error}
          isEmpty={buckets.length === 0 || totalExposure === 0}
          onRetry={() => void dash.refetch()}
          compact
          empty={{
            title: 'No MSME payable outstanding',
            detail: 'Nothing is currently owed to a registered micro or small enterprise.',
          }}
        >
          <>
            <div className="flex h-8 w-full overflow-hidden rounded-sm"
              role="img"
              aria-label={buckets
                .map(
                  (b) =>
                    `${BUCKET[b.bucket].label}: ${b.invoiceCount} invoices, ${inr(b.totalExposure)}`,
                )
                .join('; ')}
            >
              {buckets.map((b, i) => {
                const pct = (Number(b.totalExposure) / totalExposure) * 100;
                if (pct <= 0) return null;
                return (
                  <span
                    key={b.bucket}
                    // 2px surface gap between touching marks, per the mark spec —
                    // a gap, never a border drawn around the segment.
                    className={i > 0 ? 'ml-[2px]' : ''}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: CHART_STATUS[BUCKET[b.bucket].tone],
                    }}
                  />
                );
              })}
            </div>

            {/* Direct labels: the strip is never read by colour alone. */}
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {buckets.map((b) => {
                const meta = BUCKET[b.bucket];
                const selected = bucket === b.bucket;
                return (
                  <button
                    key={b.bucket}
                    type="button"
                    onClick={() => setBucket(b.bucket)}
                    aria-pressed={selected}
                    className={
                      'rounded-sm border p-2.5 text-left transition-colors duration-hover ' +
                      (selected
                        ? 'border-ink bg-canvas'
                        : 'border-line hover:bg-canvas/60')
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: CHART_STATUS[meta.tone] }}
                      />
                      <span className="text-text text-[12px] font-medium">
                        {meta.short}
                      </span>
                      <span className="text-faint text-[11px]">{meta.days}</span>
                    </span>
                    <span className="font-numeric text-ink mt-1 block text-[15px] font-semibold">
                      {inr(b.totalExposure)}
                    </span>
                    <span className="text-muted text-[11px]">
                      {b.invoiceCount} invoice{b.invoiceCount === 1 ? '' : 's'}, avg{' '}
                      {b.avgDays} days
                    </span>
                  </button>
                );
              })}
            </div>

            {breaching && (
              <p className="text-danger mt-3 flex items-start gap-1.5 text-[12px]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  Interest is already accruing on the breached invoices. §16 liability is
                  statutory — it cannot be waived by agreement with the supplier.
                </span>
              </p>
            )}
          </>
        </DataState>
      </section>

      {/* Trend. Single series, so no legend — the title names it. */}
      <section className="border-line bg-panel mb-4 rounded-lg border p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-ink text-[14px] font-semibold">
            Interest exposure, last 12 months
          </h2>
          <AsOfBadge refreshedAt={trend.data?.refreshedAt ?? null} />
        </div>
        <DataState
          isLoading={trend.isLoading}
          error={trend.error}
          // Twelve months of zeroes is not "no data" to recharts — it renders a
          // correctly-scaled, completely empty grid, which reads as a broken
          // chart. An all-zero series is an empty state and says so.
          isEmpty={trendIsEmpty}
          onRetry={() => void trend.refetch()}
          compact
          empty={{
            title: 'No interest exposure in this period',
            detail:
              'No MSME invoice passed the 45-day cap in the last 12 months. Nothing to plot.',
          }}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendPoints}>
              <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
              <XAxis dataKey="month" tick={CHART_TICK} />
              <YAxis
                tickFormatter={(v) => inrCompact(String(v))}
                tick={CHART_TICK}
                width={70}
              />
              <Tooltip
                formatter={(v: number) => [inr(String(v)), 'Interest exposure']}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: `1px solid ${CHART_CHROME.grid}`,
                }}
              />
              <Bar
                dataKey={(p: { breachExposure: string }) => Number(p.breachExposure)}
                fill={CHART_STATUS.serious}
                name="Interest exposure"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </DataState>
      </section>

      {/* Exposure detail — always rendered, defaulting to the breach bucket. */}
      <section className="overflow-x-auto">
        <div className="border-line flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-ink text-[14px] font-semibold">
            {BUCKET[bucket].label}
            <span className="text-faint ml-1.5 font-normal">{BUCKET[bucket].days}</span>
          </h2>
          <Pill variant={PILL[BUCKET[bucket].tone]} dot>
            {exposure.data?.rows.length ?? 0} invoice
            {exposure.data?.rows.length === 1 ? '' : 's'}
          </Pill>
        </div>

        <table className="w-full min-w-[640px] text-[13px]">
          <thead className="border-line border-b text-left text-[12px] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Invoice</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 text-right font-medium">Days</th>
              <th className="px-3 py-2 text-right font-medium">Net</th>
              <th className="px-3 py-2 text-right font-medium">Interest if unpaid</th>
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={5}
              isLoading={exposure.isLoading}
              error={exposure.error}
              isEmpty={(exposure.data?.rows.length ?? 0) === 0}
              onRetry={() => void exposure.refetch()}
              empty={{
                title:
                  bucket === 'BREACH_45_PLUS'
                    ? 'Nothing past the 45-day cap'
                    : 'No invoices in this band',
                detail:
                  bucket === 'BREACH_45_PLUS'
                    ? 'No MSME invoice has passed the statutory cap.'
                    : undefined,
              }}
            />
            {(exposure.data?.rows ?? []).map((r) => (
              <tr key={r.invoiceId} className="border-line hover:bg-canvas/50 border-b last:border-0">
                <td className="font-numeric px-3 py-2">{r.invoiceNumber}</td>
                <td className="text-text px-3 py-2">{r.vendorName}</td>
                <td className="font-numeric px-3 py-2 text-right">
                  {r.daysOutstanding}
                </td>
                <td className="font-numeric px-3 py-2 text-right">{inr(r.netAmount)}</td>
                <td className="font-numeric text-danger px-3 py-2 text-right font-medium">
                  {inr(r.interestIfBreached)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {exposure.data && (exposure.data.rows.length > 0) && (
          <p className="text-faint border-line border-t px-4 py-2.5 text-[11px]">
            Interest = net × RBI reference rate ({exposure.data.rbiReferenceRatePct}%) ×{' '}
            {exposure.data.interestMultiplier} × days late ÷ 365. An estimate for
            planning — not a posted liability.
          </p>
        )}
      </section>
    </div>
  );
}
