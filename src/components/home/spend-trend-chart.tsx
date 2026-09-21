'use client';

import type { HomeSummaryResponse } from '@/lib/shared';
import { CHART_CHROME, CHART_SERIES, CHART_TICK } from '@/components/ui';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { inr } from '@/lib/format';

import { ChartPanel, ChartTooltipBody } from './chart-panel';
import { dayLabel, inrShort } from './home-format';

/**
 * Daily invoice-basis spend, last 30 days. One series, so no legend — the
 * title names it; today's figure is annotated top-right because "how much
 * came in today" is the question the chart gets opened for.
 */
export function SpendTrendChart({
  data,
  isLoading,
  error,
  onRetry,
}: {
  data: HomeSummaryResponse | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}): React.JSX.Element {
  const points = useMemo(
    () => (data?.spendTrend ?? []).map((p) => ({ day: p.day, amount: Number(p.amount) })),
    [data],
  );
  const isEmpty = points.every((p) => p.amount === 0);
  const today = points[points.length - 1];

  return (
    <ChartPanel
      title="Spend trend"
      subtitle="Net invoice value per day, last 30 days"
      annotation={
        today ? (
          <span className="flex flex-col items-end">
            <span className="text-ink text-h3 font-semibold">{inrShort(today.amount)}</span>
            <span className="text-muted text-caption">today</span>
          </span>
        ) : undefined
      }
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyDetail="Spend appears here once invoices start arriving."
      onRetry={onRetry}
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {/* Accent fading to transparent: a wash under the line, never a block. */}
            <linearGradient id="home-spend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_SERIES[0]} stopOpacity={0.18} />
              <stop offset="100%" stopColor={CHART_SERIES[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={dayLabel}
            tick={CHART_TICK}
            tickLine={false}
            axisLine={{ stroke: CHART_CHROME.grid }}
            minTickGap={24}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v: number) => (v === 0 ? '0' : inrShort(v))}
            tick={CHART_TICK}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            cursor={{ stroke: CHART_CHROME.axis, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { day: string; amount: number } | undefined;
              if (!active || !p) return null;
              return (
                <ChartTooltipBody
                  title={dayLabel(p.day)}
                  rows={[{ key: 'amount', label: 'Spend', value: inr(String(p.amount), 0) }]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke={CHART_SERIES[0]}
            strokeWidth={2}
            fill="url(#home-spend-fill)"
            activeDot={{ r: 4, stroke: CHART_CHROME.surface, strokeWidth: 2, fill: CHART_SERIES[0] }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
