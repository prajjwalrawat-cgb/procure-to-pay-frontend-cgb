'use client';

import { PageHeader } from '@/components/ui';

import type { AnalyticsPeriodKey } from '@/lib/shared';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useApPerformance } from '@/lib/api/analytics';

import {
  CHART_CHROME,
  CHART_SERIES,
  CHART_STATUS,
  CHART_TICK,
  TOOLTIP_STYLE,
  humanise,
} from '../_lib';

export default function ApPerformancePage(): React.JSX.Element {
  const period: AnalyticsPeriodKey = 'LAST_12M';
  const ap = useApPerformance(period);
  const d = ap.data;

  return (
    <div>
      <PageHeader
        title="AP performance"
        breadcrumbs={[
          { label: 'Analytics', href: '/analytics' },
          { label: 'AP performance' },
        ]}
        description="Cycle time, first-pass yield, exception rate and straight-through processing, computed from posted invoices."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Avg cycle (days)" value={d ? String(d.avgCycleDays) : '—'} />
        <Kpi
          label="First-pass yield"
          value={d ? `${d.firstPassYieldPct}%` : '—'}
          accent
        />
        <Kpi label="Exception rate" value={d ? `${d.exceptionRatePct}%` : '—'} />
        <Kpi
          label="Straight-through"
          value={d ? `${d.straightThroughPct}%` : '—'}
          accent
        />
        <Kpi
          label="Discount capture"
          value={
            d ? (d.discountCapturePct == null ? 'n/a' : `${d.discountCapturePct}%`) : '—'
          }
          hint={
            d && d.discountCapturePct == null
              ? 'No early-payment discount terms in use'
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Cycle time — with exception vs clean match">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d?.cycleTrend ?? []}>
              <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
              <XAxis dataKey="month" tick={CHART_TICK} />
              <YAxis tick={CHART_TICK} width={40} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              {/* Two series, so a legend is mandatory — the lines are otherwise
                  distinguished by colour alone. */}
              <Legend
                verticalAlign="top"
                align="left"
                height={24}
                iconType="plainline"
                wrapperStyle={{ fontSize: 11, color: CHART_CHROME.axis }}
              />
              <Line
                type="monotone"
                dataKey="cleanMatch"
                stroke={CHART_SERIES[0]}
                strokeWidth={2}
                dot={false}
                name="Clean match"
              />
              <Line
                type="monotone"
                dataKey="withException"
                stroke={CHART_STATUS.serious}
                strokeWidth={2}
                dot={false}
                name="With exception"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Exception rate by type">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d?.exceptionBreakdown ?? []}>
              <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
              <XAxis
                dataKey={(e: { exceptionType: string }) => humanise(e.exceptionType)}
                tick={{ ...CHART_TICK, fontSize: 10 }}
                interval={0}
                height={44}
              />
              <YAxis tick={CHART_TICK} width={30} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar
                dataKey="count"
                fill={CHART_SERIES[0]}
                radius={[4, 4, 0, 0]}
                name="Count"
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="First-pass yield trend">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={d?.fpyTrend ?? []}>
              <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
              <XAxis dataKey="month" tick={CHART_TICK} />
              <YAxis
                tick={CHART_TICK}
                width={35}
                domain={[0, 100]}
              />
              <Tooltip formatter={(v: number) => `${v}%`} contentStyle={TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="pct"
                stroke={CHART_SERIES[0]}
                strokeWidth={2}
                dot={false}
                name="FPY %"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Straight-through processing trend">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={d?.stpTrend ?? []}>
              <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
              <XAxis dataKey="month" tick={CHART_TICK} />
              <YAxis
                tick={CHART_TICK}
                width={35}
                domain={[0, 100]}
              />
              <Tooltip formatter={(v: number) => `${v}%`} contentStyle={TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="pct"
                stroke={CHART_SERIES[0]}
                strokeWidth={2}
                dot={false}
                name="STP %"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent?: boolean;
  hint?: string;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel rounded-lg border p-3">
      <div className="text-faint text-micro">{label}</div>
      <div
        className={
          'font-numeric mt-1 text-h2 font-semibold ' +
          (accent ? 'text-accent-2' : 'text-ink')
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel rounded-lg border p-4">
      <h3 className="text-ink mb-2 text-body font-semibold">{title}</h3>
      {children}
    </div>
  );
}
