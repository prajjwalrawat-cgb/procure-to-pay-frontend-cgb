'use client';

import type { AnalyticsPeriodKey, TopVendorRow } from '@/lib/shared';
import {
  Badge,
  Button,
  CHART_CHROME,
  CHART_SERIES,
  CHART_TICK,
  KpiCard,
  PageHeader,
} from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  useConcentration,
  useContractCoverage,
  useMsmeDashboard,
  useRefreshAnalytics,
  useSavingsSummary,
  useSpendByCategory,
  useSpendTrend,
  useTopVendors,
  useTotalSpend,
} from '@/lib/api/analytics';
import { inr, inrCompact } from '@/lib/format';

import {
  AnalyticsTabs,
  AsOfBadge,
  ChartCard,
  MSME_BUCKET,
  PeriodPicker,
  TOOLTIP_STYLE,
} from './_lib';

export default function AnalyticsPage(): React.JSX.Element {
  const [period, setPeriod] = useState<AnalyticsPeriodKey>('LAST_12M');
  const [compare, setCompare] = useState(false);
  const [drill, setDrill] = useState<TopVendorRow[] | null>(null);

  const total = useTotalSpend(period);
  const trend = useSpendTrend(period, compare);
  // Amounts arrive as decimal strings. Recharts sizes the Y axis from raw
  // values, and with strings it drew a ₹1 Cr ceiling under a ₹1.08 Cr month,
  // clipping the line off the top of the chart. Numbers give it a true domain.
  const trendPoints = (trend.data?.points ?? []).map((p) => ({
    ...p,
    netSpend: Number(p.netSpend),
    priorYearNetSpend: p.priorYearNetSpend == null ? null : Number(p.priorYearNetSpend),
  }));
  const category = useSpendByCategory(period);
  const topVendors = useTopVendors(period);
  const concentration = useConcentration(period);
  const coverage = useContractCoverage(period);
  const msme = useMsmeDashboard();
  const savings = useSavingsSummary(period);
  const refresh = useRefreshAnalytics();

  const asOf = total.data?.refreshedAt ?? null;
  const breach = msme.data?.buckets.find((b) => b.bucket === 'BREACH_45_PLUS');

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Spend, savings, concentration and MSME exposure, computed from posted documents."
      />

      {/* Filters sit in one row above the charts and apply to all of them. */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <PeriodPicker value={period} onChange={setPeriod} />
        <label className="text-muted flex items-center gap-1.5 text-caption">
          <input
            type="checkbox"
            className="accent-accent"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
          />
          Compare prior FY
        </label>
        <span className="ml-auto">
          <AsOfBadge
            refreshedAt={asOf}
            onRefresh={() => refresh.mutate()}
            refreshing={refresh.isPending}
          />
        </span>
      </div>

      <AnalyticsTabs active="/analytics" />

      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Total spend"
          isLoading={total.isLoading}
          value={total.data ? inrCompact(total.data.netSpend) : '—'}
        />
        <KpiCard
          label="Hard savings"
          isLoading={savings.isLoading}
          value={savings.data ? inrCompact(savings.data.hardSavingsTotal) : '—'}
        />
        <button
          type="button"
          onClick={() => setDrill(concentration.data?.vendors ?? [])}
          disabled={!concentration.data}
          className="rounded-lg text-left"
        >
          <KpiCard
            className="hover:border-accent/40 duration-hover h-full transition-colors"
            label="Top-10 concentration"
            isLoading={concentration.isLoading}
            value={concentration.data ? `${concentration.data.concentrationPct}%` : '—'}
            footnote="Select to see the vendors"
          />
        </button>
        <KpiCard
          label="Contract coverage"
          isLoading={coverage.isLoading}
          value={coverage.data ? `${coverage.data.coveragePct}%` : '—'}
          footnote={coverage.data?.note ?? undefined}
        />
        <KpiCard
          label="MSME spend"
          isLoading={msme.isLoading}
          value={msme.data ? `${msme.data.msmeSpendPct}%` : '—'}
        />
        <Link href="/analytics/msme" className="rounded-lg">
          <KpiCard
            className="hover:border-accent/40 duration-hover h-full transition-colors"
            label="MSME 45-day exposure"
            isLoading={msme.isLoading}
            value={
              <span className={breach && breach.invoiceCount > 0 ? 'text-danger' : undefined}>
                {breach ? inrCompact(breach.totalExposure) : '—'}
              </span>
            }
            footnote={
              breach
                ? `${breach.invoiceCount} invoice${breach.invoiceCount === 1 ? '' : 's'} in breach`
                : undefined
            }
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Trend */}
        <ChartCard
          title="Monthly spend trend"
          asOf={asOf}
          className="lg:col-span-2"
          query={trend}
          isEmpty={(trend.data?.points ?? []).length === 0}
          height={240}
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={trendPoints}
              margin={{ left: 8, right: 8, top: 8 }}
            >
              <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
              <XAxis dataKey="month" tick={CHART_TICK} />
              <YAxis
                tickFormatter={(v) => inrCompact(String(v))}
                tick={CHART_TICK}
                width={70}
              />
              <Tooltip formatter={(v: number) => inr(String(v))} contentStyle={TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="netSpend"
                stroke={CHART_SERIES[0]}
                strokeWidth={2}
                dot={false}
                name="This FY"
              />
              {compare && (
                <Line
                  type="monotone"
                  dataKey="priorYearNetSpend"
                  stroke={CHART_CHROME.comparison}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Prior FY"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Spend by category.
            Was a donut. A donut is the wrong form for comparing close values —
            adjacent-slice angles are near-impossible to rank by eye, and with
            seven categories the palette also exceeds what validates for a form
            where every pair is co-visible. A ranked horizontal bar answers the
            actual question ("which categories cost most, in order") and carries
            its own labels. */}
        <ChartCard
          title="Spend by category"
          asOf={category.data?.refreshedAt ?? null}
          query={category}
          isEmpty={(category.data?.slices ?? []).length === 0}
          height={240}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={[...(category.data?.slices ?? [])].sort(
                (a, b) => Number(b.netSpend) - Number(a.netSpend),
              )}
              layout="vertical"
              margin={{ left: 6, right: 12 }}
            >
              <CartesianGrid stroke={CHART_CHROME.grid} horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) => inrCompact(String(v))}
                tick={CHART_TICK}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={110}
                tick={{ fontSize: 11, fill: CHART_CHROME.label }}
              />
              <Tooltip
                formatter={(v: number) => [inr(String(v)), 'Net spend']}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar
                dataKey={(s: { netSpend: string }) => Number(s.netSpend)}
                fill={CHART_SERIES[0]}
                name="Net spend"
                radius={[0, 4, 4, 0]}
                maxBarSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top vendors */}
        <ChartCard
          title="Top vendors by spend"
          asOf={topVendors.data?.refreshedAt ?? null}
          query={topVendors}
          isEmpty={(topVendors.data?.vendors ?? []).length === 0}
          height={320}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={topVendors.data?.vendors ?? []}
              layout="vertical"
              margin={{ left: 10, right: 10 }}
            >
              <XAxis
                type="number"
                tickFormatter={(v) => inrCompact(String(v))}
                tick={CHART_TICK}
              />
              <YAxis
                type="category"
                dataKey={(v: TopVendorRow) => (v.isMsme ? `${v.vendorName}, MSME` : v.vendorName)}
                width={150}
                // Every bar gets its name; recharts otherwise drops alternate
                // labels when they crowd, leaving unnamed bars.
                interval={0}
                tick={{ fontSize: 11, fill: CHART_CHROME.label }}
              />
              <Tooltip formatter={(v: number) => inr(String(v))} contentStyle={TOOLTIP_STYLE} />
              <Bar
                dataKey={(v: TopVendorRow) => Number(v.netSpend)}
                fill={CHART_SERIES[0]}
                radius={[0, 4, 4, 0]}
                name="Net spend"
                maxBarSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-faint mt-1 text-micro">
            MSME suppliers are marked in the label. One series, so the bars carry no
            separate identity colour.
          </p>
        </ChartCard>

        {/* MSME Section 15 widget */}
        <ChartCard
          title="MSME Section 15 aging"
          asOf={null}
          query={msme}
          isEmpty={(msme.data?.buckets ?? []).length === 0}
          height={140}
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {(msme.data?.buckets ?? []).map((b) => (
              <Link
                key={b.bucket}
                href="/analytics/msme"
                className="border-line hover:bg-canvas duration-hover rounded-md border p-3 transition-colors"
              >
                <div className="text-text text-caption font-medium">
                  {MSME_BUCKET[b.bucket].short}
                </div>
                <div className="text-faint text-micro">
                  {MSME_BUCKET[b.bucket].days}
                </div>
                <div className="font-numeric text-ink mt-1 text-h2 font-semibold">
                  {b.invoiceCount}
                </div>
                <div className="text-muted font-numeric text-micro">
                  {inrCompact(b.totalExposure)}
                </div>
              </Link>
            ))}
          </div>
          <p className="text-faint mt-2 text-micro">
            Select a bucket to see the at-risk invoices behind it.
          </p>
        </ChartCard>
      </div>

      {drill && <ConcentrationDrawer vendors={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}

function ConcentrationDrawer({
  vendors,
  onClose,
}: {
  vendors: TopVendorRow[];
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div
      className="bg-ink/30 fixed inset-0 z-50 flex justify-end"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="bg-panel border-line h-full w-full max-w-lg overflow-y-auto border-l p-5"
        role="dialog"
        aria-modal="true"
        aria-label="Top-10 vendor concentration"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-ink text-h3 font-semibold">
            Top-10 vendor concentration
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <table className="w-full text-body-sm">
          <thead className="border-line border-b text-left">
            <tr>
              <th className="text-muted py-2.5 pr-3 text-caption font-medium">Vendor</th>
              <th className="text-muted px-3 py-2.5 text-right text-caption font-medium">
                Net spend
              </th>
              <th className="text-muted py-2.5 pl-3 text-right text-caption font-medium">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.vendorId} className="border-line border-b last:border-0">
                <td className="py-3 pr-3">
                  <Link
                    href={`/vendors/${v.vendorId}`}
                    className="text-accent hover:underline"
                  >
                    {v.vendorName}
                  </Link>
                  {v.isMsme && (
                    <Badge variant="classification" className="ml-1.5">
                      MSME
                    </Badge>
                  )}
                </td>
                <td className="font-numeric px-3 py-3 text-right tabular-nums">
                  {inr(v.netSpend)}
                </td>
                <td className="text-muted font-numeric py-3 pl-3 text-right tabular-nums">
                  {v.pctOfTotal}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
