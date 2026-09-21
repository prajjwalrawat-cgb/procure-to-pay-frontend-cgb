'use client';

import type { HomeSummaryResponse } from '@/lib/shared';
import { CHART_CHROME, CHART_SERIES, CHART_TICK } from '@/components/ui';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { qty } from '@/lib/format';

import { ChartPanel, ChartTooltipBody } from './chart-panel';
import { dayLabel } from './home-format';

/** Stack order bottom → top; colours are the categorical slots in fixed order. */
const SERIES = [
  { key: 'requisitions', label: 'Requisitions', color: CHART_SERIES[0] },
  { key: 'purchaseOrders', label: 'Purchase orders', color: CHART_SERIES[1] },
  { key: 'invoices', label: 'Invoices', color: CHART_SERIES[2] },
] as const;

type Row = HomeSummaryResponse['throughput'][number];

/**
 * Documents created per day, last 14 days, stacked by type. Three series, so a
 * legend is always shown; segments are separated by a 2px stroke in the panel
 * colour (the "surface gap"), not by an outline.
 */
export function ThroughputChart({
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
  const rows = data?.throughput ?? [];
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          requisitions: acc.requisitions + r.requisitions,
          purchaseOrders: acc.purchaseOrders + r.purchaseOrders,
          invoices: acc.invoices + r.invoices,
        }),
        { requisitions: 0, purchaseOrders: 0, invoices: 0 },
      ),
    [rows],
  );
  const isEmpty = totals.requisitions + totals.purchaseOrders + totals.invoices === 0;

  return (
    <ChartPanel
      title="Document throughput"
      subtitle="Created per day, last 14 days"
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyDetail="Requisitions, POs and invoices created each day will stack up here."
      onRetry={onRetry}
      legend={
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {SERIES.map((s) => (
            <li key={s.key} className="text-muted flex items-center gap-1.5 text-caption">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
              <span className="text-ink font-medium">{qty(totals[s.key])}</span>
            </li>
          ))}
        </ul>
      }
    >
      <ResponsiveContainer width="100%" height={196}>
        <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="25%">
          <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={dayLabel}
            tick={CHART_TICK}
            tickLine={false}
            axisLine={{ stroke: CHART_CHROME.grid }}
            minTickGap={16}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tick={CHART_TICK}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: 'var(--pf-canvas)' }}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as Row | undefined;
              if (!active || !r) return null;
              return (
                <ChartTooltipBody
                  title={dayLabel(r.day)}
                  rows={[
                    // Top of the stack first, so the list reads in the order the eye meets it.
                    ...[...SERIES].reverse().map((s) => ({
                      key: s.key,
                      label: s.label,
                      value: qty(r[s.key]),
                      color: s.color,
                    })),
                    {
                      key: 'total',
                      label: 'Total',
                      value: qty(r.requisitions + r.purchaseOrders + r.invoices),
                      strong: true,
                    },
                  ]}
                />
              );
            }}
          />
          {SERIES.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="docs"
              fill={s.color}
              stroke={CHART_CHROME.surface}
              strokeWidth={2}
              maxBarSize={24}
              radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
