'use client';

/**
 * Why this quote scored what it scored.
 *
 * The evaluation engine is a real weighted model — price 60 / delivery 20 /
 * quality 10 / MSME 10 by default, with price auto-scored as
 * (L1_price / this_price) x 100 and an MSME purchase-preference boost. The UI
 * was showing only the raw scores and a bold total, so "why did this vendor
 * win" was unanswerable without opening the code. Awarding a contract on a
 * number nobody can decompose is exactly the kind of thing this product should
 * not ask a buyer to do.
 *
 * Every figure here comes from the API (`weightedScore` per criterion); nothing
 * is recomputed client-side, so the breakdown cannot drift from the total the
 * engine actually persisted.
 *
 * ── Colour ────────────────────────────────────────────────────────────────
 * A monochrome navy ramp, ordered by weight, rather than a categorical hue
 * palette. Criteria are not states, and borrowing the semantic colours here
 * would make "quality: green" read as a pass. Weight is the only thing the
 * ramp encodes: the heaviest criterion is the darkest.
 */

import * as React from 'react';

import { cn } from '../lib/cn';

export interface ScoreCriterion {
  key: string;
  label: string;
  /** Whole-number percentage weight; the set sums to 100. */
  weight: number;
}

export interface ScoreContribution {
  criterion: string;
  /** 0-100 score before weighting. */
  rawScore: string | null;
  /** rawScore x weight / 100 — the points this criterion contributed. */
  weightedScore: string | null;
}

/** Darkest = heaviest. Five steps is enough for any realistic criteria set. */
const RAMP = [
  'bg-navy',
  'bg-navy-2',
  'bg-navy-3',
  'bg-info',
  'bg-faint',
] as const;

function rampFor(index: number): string {
  return RAMP[Math.min(index, RAMP.length - 1)];
}

export interface ScoreBreakdownProps {
  criteria: ScoreCriterion[];
  scores: ScoreContribution[];
  /** The engine's persisted total. Shown as-is, never recomputed. */
  total: string | null;
  /** Hide the bar and render only the table — for tight rail placements. */
  compact?: boolean;
  className?: string;
}

export function ScoreBreakdown({
  criteria,
  scores,
  total,
  compact,
  className,
}: ScoreBreakdownProps): React.JSX.Element {
  // Heaviest first, so the ramp reads as a hierarchy and the bar's biggest
  // block sits on the left where the eye starts.
  const ordered = React.useMemo(
    () => [...criteria].sort((a, b) => b.weight - a.weight),
    [criteria],
  );

  const rows = ordered.map((c, i) => {
    const s = scores.find((x) => x.criterion === c.key);
    const contribution = s?.weightedScore == null ? null : Number(s.weightedScore);
    return {
      ...c,
      raw: s?.rawScore ?? null,
      contribution,
      ramp: rampFor(i),
    };
  });

  const scored = rows.filter((r) => r.contribution !== null);
  const anyScored = scored.length > 0;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {!compact && (
        <div>
          {/* The bar is out of 100 possible points, not normalised to the
              achieved total — so a mediocre quote reads as a visibly
              part-filled bar rather than a full one. */}
          <div
            className="border-line bg-canvas flex h-2.5 w-full overflow-hidden rounded-full border"
            role="img"
            aria-label={
              anyScored
                ? `Weighted score ${total ?? '0'} of 100`
                : 'Not yet scored'
            }
          >
            {rows.map((r) =>
              r.contribution === null || r.contribution <= 0 ? null : (
                <span
                  key={r.key}
                  className={cn(r.ramp, 'h-full')}
                  style={{ width: `${Math.min(100, r.contribution)}%` }}
                />
              ),
            )}
          </div>
          <div className="text-faint mt-1 flex justify-between text-micro">
            <span>0</span>
            <span>out of 100</span>
          </div>
        </div>
      )}

      <table className="w-full text-micro">
        <thead className="border-line border-b text-left text-caption text-muted">
          <tr>
            <th className="py-0.5 font-medium">Criterion</th>
            <th className="py-0.5 text-right font-medium">Weight</th>
            <th className="py-0.5 text-right font-medium">Score</th>
            <th className="py-0.5 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="py-0.5">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn('h-2 w-2 shrink-0 rounded-sm', r.ramp)}
                  />
                  <span className="text-text">{r.label}</span>
                </span>
              </td>
              <td className="font-numeric text-muted py-0.5 text-right">{r.weight}%</td>
              <td className="font-numeric text-muted py-0.5 text-right">
                {r.raw ?? '—'}
              </td>
              <td className="font-numeric text-ink py-0.5 text-right font-medium">
                {r.contribution === null ? '—' : r.contribution.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-line border-t">
            <td className="text-muted py-1" colSpan={3}>
              Weighted total
            </td>
            <td className="font-numeric text-ink py-1 text-right font-semibold">
              {total ?? '—'}
            </td>
          </tr>
        </tfoot>
      </table>

      {!anyScored && (
        <p className="text-faint text-micro">
          Not scored yet — run auto-scoring, then enter the manual criteria.
        </p>
      )}
    </div>
  );
}
