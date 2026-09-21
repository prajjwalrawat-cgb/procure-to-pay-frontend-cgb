'use client';

/**
 * A KPI tile. One of only two places the display serif is allowed (the other is
 * PageHeader), because the value is the thing the eye should land on first.
 *
 * Deliberately not a "stat card hero": no gradient, no icon chrome, no
 * decorative sparkline. The value carries the weight, the delta is annotated
 * with its direction *and* whether that direction is good — a rising figure is
 * not automatically progress when the metric is overdue invoices.
 */

import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Skeleton } from './data-state';
import { InfoTip } from './tooltip';

export type KpiDirection = 'up' | 'down' | 'flat';
/** Whether the movement is good, bad, or simply neutral for this metric. */
export type KpiSentiment = 'good' | 'bad' | 'neutral';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  /** e.g. "+12.4% vs last month" */
  delta?: string;
  direction?: KpiDirection;
  sentiment?: KpiSentiment;
  /** Small clarifier under the value, e.g. "across 38 invoices". */
  footnote?: React.ReactNode;
  /** Explains how the number is derived — worth having on anything computed. */
  help?: React.ReactNode;
  isLoading?: boolean;
  /** Renders the value in the mono face. Default true — most KPIs are numbers. */
  numeric?: boolean;
  className?: string;
}

const ARROW: Record<KpiDirection, React.ElementType> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
};

export function KpiCard({
  label,
  value,
  delta,
  direction = 'flat',
  sentiment = 'neutral',
  footnote,
  help,
  isLoading,
  numeric = true,
  className,
}: KpiCardProps): React.JSX.Element {
  const Arrow = ARROW[direction];

  return (
    <div
      className={cn(
        'border-line bg-panel shadow-xs flex flex-col rounded-lg border p-3.5',
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-faint text-micro font-medium ">
          {label}
        </span>
        {help && (
          <InfoTip content={help}>
            <button
              type="button"
              aria-label={`How ${label} is calculated`}
              className="border-line text-faint hover:text-ink duration-hover flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-micro font-semibold transition-colors"
            >
              ?
            </button>
          </InfoTip>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : (
        <div
          className={cn(
            'text-ink mt-1.5 text-h1 leading-none',
            numeric ? 'font-numeric font-semibold' : 'font-display tracking-display',
          )}
        >
          {value}
        </div>
      )}

      {(delta ?? footnote) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {delta && !isLoading && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-micro font-medium',
                sentiment === 'good' && 'text-accent',
                sentiment === 'bad' && 'text-danger',
                sentiment === 'neutral' && 'text-muted',
              )}
            >
              <Arrow className="h-3 w-3" aria-hidden />
              {delta}
            </span>
          )}
          {footnote && <span className="text-faint text-micro">{footnote}</span>}
        </div>
      )}
    </div>
  );
}
