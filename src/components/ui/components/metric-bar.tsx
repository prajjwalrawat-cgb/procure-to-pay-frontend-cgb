'use client';

/**
 * One performance metric, shown against the scale it is actually measured on.
 *
 * The vendor scorecard was a column of bare numbers — "OTIF 87", "Dispute rate
 * 4" — which tells you the value but not whether it is good, and gives no way
 * to compare two metrics at a glance.
 *
 * ── Only percentages get a bar ─────────────────────────────────────────────
 * OTIF, quality, dispute rate, RFQ participation and win rate are 0-100, so a
 * bar is meaningful. Response time (hours) and payment cycle (days) are
 * durations with no upper bound and no target in the API — drawing a bar for
 * them would require inventing a denominator, so they render as a value only.
 * A fake scale is worse than no scale.
 *
 * `inverse` marks metrics where lower is better (dispute rate), so the bar is
 * read correctly rather than looking like underperformance.
 *
 * ── Only band what has a target ────────────────────────────────────────────
 * OTIF, quality and dispute rate have real performance targets, so they are
 * banded good/watch/problem. Win rate and RFQ participation do not: a 45%
 * RFQ win rate is a perfectly healthy supplier, and colouring it red because
 * it fell under an OTIF-shaped threshold invents a judgement the data does not
 * support. Those render `tone="neutral"` — the bar shows magnitude only.
 */

import * as React from 'react';

import { cn } from '../lib/cn';

export interface MetricBarProps {
  label: string;
  value: number | null;
  /**
   * Why there is no value yet. Shown instead of the bar when `value` is null.
   *
   * A metric with no data used to render a dash above an empty track, and an
   * empty track is indistinguishable from a zero — so a supplier you have
   * never traded with looked like a supplier scoring nought on every measure.
   */
  emptyReason?: string;
  /** Appended to the value, e.g. '%', 'h', 'd'. */
  suffix?: string;
  /** Render the 0-100 bar. Omit for unbounded values like hours or days. */
  scale?: boolean;
  /** Lower is better — e.g. dispute rate. */
  inverse?: boolean;
  /**
   * 'banded' colours the bar good/watch/problem against a performance target.
   * 'neutral' shows magnitude without a verdict — for metrics with no target.
   */
  tone?: 'banded' | 'neutral';
  /** Explains how the metric is derived. */
  help?: React.ReactNode;
  className?: string;
}

/**
 * Bands are deliberately coarse. The scorecard is a triage tool, not a
 * ranking: "fine / watch / problem" is the decision a category manager makes.
 */
function band(pct: number, inverse: boolean): 'good' | 'warn' | 'bad' {
  const effective = inverse ? 100 - pct : pct;
  if (effective >= 90) return 'good';
  if (effective >= 75) return 'warn';
  return 'bad';
}

const FILL: Record<'good' | 'warn' | 'bad' | 'neutral', string> = {
  good: 'bg-success-solid',
  warn: 'bg-warn-solid',
  bad: 'bg-danger-solid',
  neutral: 'bg-faint-line',
};

export function MetricBar({
  label,
  value,
  emptyReason = 'Not enough transaction history yet',
  suffix = '',
  scale,
  inverse = false,
  tone = 'banded',
  help,
  className,
}: MetricBarProps): React.JSX.Element {
  const hasValue = value !== null && Number.isFinite(value);
  const pct = hasValue ? Math.max(0, Math.min(100, value)) : 0;
  const fill = !hasValue ? null : tone === 'neutral' ? 'neutral' : band(pct, inverse);

  return (
    <div className={cn('py-1', className)}>
      <div className="flex items-baseline justify-between gap-3 text-body-sm">
        <span className="text-muted" title={typeof help === 'string' ? help : undefined}>
          {label}
        </span>
        {hasValue ? (
          <span className="font-numeric text-ink">{`${value}${suffix}`}</span>
        ) : null}
      </div>
      {!hasValue && <p className="text-faint mt-0.5 text-caption">{emptyReason}</p>}
      {scale && hasValue && (
        <div
          className="bg-canvas border-line mt-1 h-1.5 w-full overflow-hidden rounded-full border"
          role="img"
          aria-label={`${label}: ${value}${suffix} of 100`}
        >
          {fill && (
            <span
              className={cn('block h-full rounded-full', FILL[fill])}
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      )}
    </div>
  );
}
