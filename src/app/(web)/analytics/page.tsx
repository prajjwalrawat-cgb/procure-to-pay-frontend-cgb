'use client';

import type { AnalyticsPeriodKey, TopVendorRow } from '@/lib/shared';
import {
  CHART_CHROME,
  CHART_SERIES,
  CHART_TICK,
  PageHeader,
  Pill,
  SubNav,
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

import { AsOfBadge, MSME_BUCKET, PeriodPicker, TOOLTIP_STYLE } from './_lib';

const TABS = [
  { label: 'Overview', href: '/analytics' },
  { label: 'Savings', href: '/analytics/savings' },
  { label: 'MSME', href: '/analytics/msme' },
  { label: 'AP Performance', href: '/analytics/ap-performance' },
];

export default function AnalyticsPage(): React.JSX.Element {
  const [period, setPeriod] = useState<AnalyticsPeriodKey>('LAST_12M');
  const [compare, setCompare] = useState(false);
  const [drill, setDrill] = useState<TopVendorRow[] | null>(null);

  const total = useTotalSpend(period);
  const trend = useSpendTrend(period, compare);
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

      <SubNav
        className="mb-4"
        aria-label="Analytics views"
        items={TABS.map((t) => ({ key: t.href, label: t.label, href: t.href }))}
        value="/analytics"
        renderLink={(item, content) => (
          <Link key={item.key} href={item.href ?? '#'}>
            {content}
          </Link>
        )}
      />

      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Total spend"
          value={total.data ? inrCompact(total.data.netSpend) : '—'}
        />
        <Kpi
          label="Hard savings"
          value={savings.data ? inrCompact(savings.data.hardSavingsTotal) : '—'}
          accent
        />
        <button
          onClick={() => setDrill(concentration.data?.vendors ?? [])}
          className="text-left"
        >
          <Kpi
            label="Top-10 concentration"
            value={concentration.data ? `${concentration.data.concentrationPct}%` : '—'}
            hint="Click to drill down"
          />
        </button>
        <Kpi
          label="Contract coverage"
          value={coverage.data ? `${coverage.data.coveragePct}%` : '—'}
          hint={coverage.data?.note ?? undefined}
        />
        <Kpi label="MSME spend" value={msme.data ? `${msme.data.msmeSpendPct}%` : '—'} />
        <Link href="/analytics/msme">
          <Kpi
            label="MSME 45-day exposure"
            value={breach ? inrCompact(breach.totalExposure) : '—'}
            danger={!!breach && breach.invoiceCount > 0}
            hint={breach ? `${breach.invoiceCount} invoice(s) in breach` : undefined}
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Trend */}
        <Card title="Monthly spend trend" asOf={asOf} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={trend.data?.points ?? []}
              margin={{ left: 8, right: 8, top: 8 }}
            >
              <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
              <XAxis dataKey="month" tick={CHART_TICK} />
              <YAxis
                tickFormatter={(v) => inrCompact(String(v))}
                tick={CHART_TICK}
                width={70}
              />
              <Tooltip formatter={(v: number) => inr(String(v))} />
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
        </Card>

        {/* Spend by category.
            Was a donut. A donut is the wrong form for comparing close values —
            adjacent-slice angles are near-impossible to rank by eye, and with
            seven categories the palette also exceeds what validates for a form
            where every pair is co-visible. A ranked horizontal bar answers the
            actual question ("which categories cost most, in order") and carries
            its own labels. */}
        <Card title="Spend by category" asOf={category.data?.refreshedAt ?? null}>
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
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top vendors */}
        <Card title="Top vendors by spend" asOf={topVendors.data?.refreshedAt ?? null}>
          <ResponsiveContainer width="100%" height={280}>
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
                tick={{ fontSize: 11, fill: CHART_CHROME.label }}
              />
              <Tooltip formatter={(v: number) => inr(String(v))} />
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
        </Card>

        {/* MSME Section 15 widget */}
        <Card title="MSME Section 15 — aging" asOf={null}>
          <div className="grid grid-cols-3 gap-2">
            {(msme.data?.buckets ?? []).map((b) => (
              <Link
                key={b.bucket}
                href="/analytics/msme"
                className="border-line hover:bg-canvas rounded-md border p-3"
              >
                <div className="text-faint text-micro">
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
            Click a bucket to see the at-risk invoices behind it.
          </p>
        </Card>
      </div>

      {drill && <ConcentrationDrawer vendors={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  danger,
  hint,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
  hint?: string;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel rounded-lg border p-3">
      <div className="text-faint text-micro">{label}</div>
      <div
        className={
          'font-numeric tracking-display mt-1 text-h2 font-semibold ' +
          (danger ? 'text-danger' : accent ? 'text-accent-2' : 'text-ink')
        }
      >
        {value}
      </div>
      {hint && <div className="text-faint mt-0.5 text-micro">{hint}</div>}
    </div>
  );
}

function Card({
  title,
  asOf,
  className,
  children,
}: {
  title: string;
  asOf: string | null;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={'border-line bg-panel rounded-lg border p-4 ' + (className ?? '')}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-ink text-body font-semibold">{title}</h3>
        <AsOfBadge refreshedAt={asOf} />
      </div>
      {children}
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
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="bg-panel border-line h-full w-full max-w-lg overflow-y-auto border-l p-5"
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-ink text-h3 font-semibold">
            Top-10 vendor concentration
          </h3>
          <button onClick={onClose} className="text-muted hover:text-ink text-body-sm">
            Close
          </button>
        </div>
        <table className="w-full text-body-sm">
          <tbody>
            {vendors.map((v) => (
              <tr key={v.vendorId} className="border-line border-b last:border-0">
                <td className="py-2">
                  <Link
                    href={`/vendors/${v.vendorId}`}
                    className="text-accent-2 hover:underline"
                  >
                    {v.vendorName}
                  </Link>
                  {v.isMsme && (
                    <Pill variant="success" className="ml-1">
                      MSME
                    </Pill>
                  )}
                </td>
                <td className="font-numeric py-2 text-right tabular-nums">
                  {inr(v.netSpend)}
                </td>
                <td className="text-muted font-numeric py-2 text-right tabular-nums">
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
