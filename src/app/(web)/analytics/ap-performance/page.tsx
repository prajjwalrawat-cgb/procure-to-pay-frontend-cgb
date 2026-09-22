'use client';

import { KpiCard, PageHeader } from '@/components/ui';

import type { AnalyticsPeriodKey } from '@/lib/shared';
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
  AnalyticsTabs,
  ChartCard,
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

      <AnalyticsTabs active="/analytics/ap-performance" />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Avg cycle (days)"
          isLoading={ap.isLoading}
          value={d ? String(d.avgCycleDays) : '—'}
        />
        <KpiCard
          label="First-pass yield"
          isLoading={ap.isLoading}
          value={d ? `${d.firstPassYieldPct}%` : '—'}
        />
        <KpiCard
          label="Exception rate"
          isLoading={ap.isLoading}
          value={d ? `${d.exceptionRatePct}%` : '—'}
        />
        <KpiCard
          label="Straight-through"
          isLoading={ap.isLoading}
          value={d ? `${d.straightThroughPct}%` : '—'}
        />
        <KpiCard
          isLoading={ap.isLoading}
          label="Discount capture"
          value={
            d ? (d.discountCapturePct == null ? 'n/a' : `${d.discountCapturePct}%`) : '—'
          }
          footnote={
            d && d.discountCapturePct == null
              ? 'No early-payment discount terms in use'
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Cycle time, with exception vs clean match"
          query={ap}
          isEmpty={(d?.cycleTrend ?? []).length === 0}
          height={240}
        >
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
        </ChartCard>

        <ChartCard
          title="Exception rate by type"
          query={ap}
          isEmpty={(d?.exceptionBreakdown ?? []).length === 0}
          height={240}
          empty={{ title: 'No exceptions raised in this period' }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d?.exceptionBreakdown ?? []}>
              <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
              <XAxis
                dataKey={(e: { exceptionType: string }) => humanise(e.exceptionType)}
                // Eight type names do not fit side by side at half width; flat
                // labels ran into each other ("Amount mismatchDocument…").
                tick={{ ...CHART_TICK, fontSize: 10 }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={72}
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
        </ChartCard>

        <ChartCard
          title="First-pass yield trend"
          query={ap}
          isEmpty={(d?.fpyTrend ?? []).length === 0}
          height={220}
        >
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
        </ChartCard>

        <ChartCard
          title="Straight-through processing trend"
          query={ap}
          isEmpty={(d?.stpTrend ?? []).length === 0}
          height={220}
        >
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
        </ChartCard>
      </div>
    </div>
  );
}
