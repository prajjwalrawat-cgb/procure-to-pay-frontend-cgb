'use client';

import type { AnalyticsPeriodKey, TopVendorRow } from '@procureflow/shared';
import { Pill } from '@procureflow/ui';
import Link from 'next/link';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
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

import { ACCENT, AsOfBadge, CHART_COLORS, PeriodPicker, PRIOR } from './_lib';

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
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            Analytics
          </h1>
          <p className="text-muted text-[13px]">
            Spend, savings, concentration and MSME exposure — computed from real Slice 1–7
            data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-muted flex items-center gap-1.5 text-[12px]">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
            />
            Compare prior FY
          </label>
          <PeriodPicker value={period} onChange={setPeriod} />
          <AsOfBadge
            refreshedAt={asOf}
            onRefresh={() => refresh.mutate()}
            refreshing={refresh.isPending}
          />
        </div>
      </div>

      <div className="border-line mb-4 flex items-center gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={
              'border-b-2 px-3 py-2 text-[13px] font-medium ' +
              (t.href === '/analytics'
                ? 'border-accent text-ink'
                : 'text-muted hover:text-text border-transparent')
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

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
              <CartesianGrid stroke="#E8E8E1" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#65655E' }} />
              <YAxis
                tickFormatter={(v) => inrCompact(String(v))}
                tick={{ fontSize: 11, fill: '#65655E' }}
                width={70}
              />
              <Tooltip formatter={(v: number) => inr(String(v))} />
              <Line
                type="monotone"
                dataKey="netSpend"
                stroke={ACCENT}
                strokeWidth={2}
                dot={false}
                name="This FY"
              />
              {compare && (
                <Line
                  type="monotone"
                  dataKey="priorYearNetSpend"
                  stroke={PRIOR}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Prior FY"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Category donut */}
        <Card title="Spend by category" asOf={category.data?.refreshedAt ?? null}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={category.data?.slices ?? []}
                dataKey={(s: { netSpend: string }) => Number(s.netSpend)}
                nameKey="category"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {(category.data?.slices ?? []).map((_s, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => inr(String(v))} />
            </PieChart>
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
                tick={{ fontSize: 11, fill: '#65655E' }}
              />
              <YAxis
                type="category"
                dataKey="vendorName"
                width={130}
                tick={{ fontSize: 11, fill: '#2E2E2C' }}
              />
              <Tooltip formatter={(v: number) => inr(String(v))} />
              <Bar
                dataKey={(v: TopVendorRow) => Number(v.netSpend)}
                radius={[0, 4, 4, 0]}
                name="Net spend"
              >
                {(topVendors.data?.vendors ?? []).map((v, i) => (
                  <Cell key={i} fill={v.isMsme ? ACCENT : '#0276B2'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-faint mt-1 text-[11px]">MSME vendors shown in emerald.</p>
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
                <div className="text-faint text-[10px] uppercase">
                  {b.bucket.replace(/_/g, ' ')}
                </div>
                <div className="font-numeric text-ink mt-1 text-[18px] font-semibold">
                  {b.invoiceCount}
                </div>
                <div className="text-muted font-numeric text-[11px]">
                  {inrCompact(b.totalExposure)}
                </div>
              </Link>
            ))}
          </div>
          <p className="text-faint mt-2 text-[11px]">
            Live · click a bucket to see at-risk invoices.
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
      <div className="text-faint text-[11px] uppercase">{label}</div>
      <div
        className={
          'font-numeric tracking-display mt-1 text-[20px] font-semibold ' +
          (danger ? 'text-danger' : accent ? 'text-accent-2' : 'text-ink')
        }
      >
        {value}
      </div>
      {hint && <div className="text-faint mt-0.5 text-[10px]">{hint}</div>}
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
        <h3 className="text-ink text-[14px] font-semibold">{title}</h3>
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
          <h3 className="text-ink text-[15px] font-semibold">
            Top-10 vendor concentration
          </h3>
          <button onClick={onClose} className="text-muted hover:text-ink text-[13px]">
            Close
          </button>
        </div>
        <table className="w-full text-[13px]">
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
