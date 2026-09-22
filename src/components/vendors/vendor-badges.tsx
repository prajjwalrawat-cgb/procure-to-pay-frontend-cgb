'use client';

import { Badge, InfoTip, cn } from '@/components/ui';
import { BadgeCheck, Info } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import type { VendorLifecycleStatus } from '@/lib/shared';

import { useVendorCategoryOptions } from '@/lib/api/settings';
import { humanise } from '@/lib/format';

/**
 * The vendor trust badges and grade chips, defined once so the grid, the
 * table view, the vendor profile and the onboarding queue all say the same
 * thing about the same supplier.
 *
 * MSME and Verified are independent facts. The grid used to render Verified
 * only when a vendor was *not* MSME, so an active MSME supplier never showed
 * as verified — which read as "MSME vendors are unvetted".
 */

export const MSME_MEANING =
  'The vendor declared MSME status with a Udyam registration number during onboarding. Payments to them fall under the 45-day MSMED Act limit.';
export const VERIFIED_MEANING =
  'Onboarding was approved and the vendor is active: their documents, screenings and bank account were reviewed before activation.';
export const RISK_MEANING =
  'Risk of doing business — screenings, document validity, disputes and blacklist history. A+ is the lowest risk, D the highest; a sanctions hit or blacklist history forces D.';
export const SCORECARD_MEANING =
  'Delivery performance — OTIF, quality, response time, disputes, payment cycle and RFQ activity. A+ ≥ 90, A ≥ 80, B ≥ 65, C ≥ 50, D below 50. No grade until three transactions.';

export function MsmeBadge({ className }: { className?: string }): React.JSX.Element {
  return (
    // Badge does not forward a ref, which the tooltip trigger needs — so a
    // focusable span is the trigger and the badge sits inside it.
    <InfoTip content={MSME_MEANING}>
      <span tabIndex={0} className="inline-flex rounded-pill">
        <Badge variant="classification" className={className}>
          MSME
        </Badge>
      </span>
    </InfoTip>
  );
}

export function VerifiedBadge({ className }: { className?: string }): React.JSX.Element {
  return (
    <InfoTip content={VERIFIED_MEANING}>
      <span tabIndex={0} className="inline-flex rounded-pill">
        <Badge variant="positive" icon={BadgeCheck} className={className}>
          Verified
        </Badge>
      </span>
    </InfoTip>
  );
}

/** Both trust badges, each on its own rule. Renders nothing when neither applies. */
export function VendorTrustBadges({
  isMsme,
  lifecycleStatus,
  className,
}: {
  isMsme: boolean;
  lifecycleStatus: VendorLifecycleStatus;
  className?: string;
}): React.JSX.Element | null {
  const verified = lifecycleStatus === 'ACTIVE';
  if (!isMsme && !verified) return null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      {isMsme && <MsmeBadge />}
      {verified && <VerifiedBadge />}
    </span>
  );
}

// ── Grades ───────────────────────────────────────────────────────────────────

type GradeTone = 'success' | 'info' | 'warn' | 'danger' | 'neutral';

/**
 * Both grades use the A+…D scale (VENDOR_RISK_GRADE). Anything else — the
 * scorecard's "N/A" cold start, or a grade the server adds later — is neutral
 * rather than guessed at.
 */
export function gradeTone(grade: string | null | undefined): GradeTone {
  switch (grade) {
    case 'A+':
    case 'A':
      return 'success';
    case 'B':
      return 'info';
    case 'C':
      return 'warn';
    case 'D':
    case 'E':
    case 'F':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** Rank for sorting: best first. Ungraded vendors return null so they sink. */
export function gradeRank(grade: string | null | undefined): number | null {
  const i = ['A+', 'A', 'B', 'C', 'D', 'E', 'F'].indexOf(grade ?? '');
  return i === -1 ? null : i;
}

const TONE_CLASS: Record<GradeTone, string> = {
  success: 'bg-success-bg text-success',
  info: 'bg-info-bg text-info',
  warn: 'bg-warn-bg text-warn',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-canvas text-muted',
};

/** A word beside each letter, so the chip reads without the colour or the legend. */
const RISK_WORD: Record<string, string> = {
  'A+': 'Low risk',
  A: 'Low risk',
  B: 'Moderate',
  C: 'Elevated',
  D: 'High risk',
};
const SCORE_WORD: Record<string, string> = {
  'A+': 'Excellent',
  A: 'Good',
  B: 'Fair',
  C: 'Weak',
  D: 'Poor',
};

function GradeChip({
  label,
  grade,
  words,
  meaning,
  emptyText,
  provisional,
  className,
}: {
  label: string;
  grade: string | null | undefined;
  words: Record<string, string>;
  meaning: string;
  emptyText: string;
  provisional?: boolean;
  className?: string;
}): React.JSX.Element {
  const word = grade ? words[grade] : undefined;
  const graded = !!grade && grade !== 'N/A';
  // A grade earned on fewer than three transactions keeps its letter but not
  // a confident colour — the colour is what people actually read.
  const tone = graded && !provisional ? gradeTone(grade) : 'neutral';
  return (
    <InfoTip
      content={
        <>
          <span className="font-semibold">{label}.</span> {meaning}
          {provisional ? ' Provisional: based on too few transactions to rely on.' : ''}
        </>
      }
    >
      <span
        tabIndex={0}
        aria-label={`${label}: ${graded ? `${grade}${word ? ` ${word}` : ''}` : emptyText}${provisional ? ' (provisional)' : ''}`}
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-micro font-medium leading-[18px]',
          TONE_CLASS[tone],
          className,
        )}
      >
        {graded ? (
          <>
            <span className="font-numeric font-semibold">{grade}</span>
            {(word || provisional) && (
              <span className="font-normal">· {provisional ? 'provisional' : word}</span>
            )}
          </>
        ) : (
          emptyText
        )}
      </span>
    </InfoTip>
  );
}

export function RiskGradeChip({
  grade,
  className,
}: {
  grade: string | null | undefined;
  className?: string;
}): React.JSX.Element {
  return (
    <GradeChip
      label="Risk grade"
      grade={grade}
      words={RISK_WORD}
      meaning={RISK_MEANING}
      emptyText="Not assessed"
      className={className}
    />
  );
}

export function ScorecardGradeChip({
  grade,
  provisional,
  className,
}: {
  grade: string | null | undefined;
  provisional?: boolean;
  className?: string;
}): React.JSX.Element {
  return (
    <GradeChip
      label="Scorecard grade"
      grade={grade}
      words={SCORE_WORD}
      meaning={SCORECARD_MEANING}
      emptyText="No history"
      provisional={provisional}
      className={className}
    />
  );
}

// ── Legend ───────────────────────────────────────────────────────────────────

/**
 * The key to the badges and chips, as a disclosure rather than a tooltip so it
 * is reachable on a phone, where hover tooltips never open.
 */
export function VendorBadgeLegend({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  const scale = ['A+', 'A', 'B', 'C', 'D'];
  return (
    <details className={cn('group text-caption', className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm font-medium text-muted hover:text-text [&::-webkit-details-marker]:hidden">
        <Info className="h-3.5 w-3.5" aria-hidden />
        What the badges and grades mean
      </summary>
      <dl className="mt-2 grid gap-x-6 gap-y-3 rounded-lg border border-line bg-panel p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt>
            <Badge variant="classification">MSME</Badge>
          </dt>
          <dd className="leading-relaxed text-muted">{MSME_MEANING}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt>
            <Badge variant="positive" icon={BadgeCheck}>
              Verified
            </Badge>
          </dt>
          <dd className="leading-relaxed text-muted">{VERIFIED_MEANING}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-medium text-text">Risk grade</dt>
          <dd className="leading-relaxed text-muted">{RISK_MEANING}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-medium text-text">Scorecard grade</dt>
          <dd className="leading-relaxed text-muted">{SCORECARD_MEANING}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
          <span className="mr-1 text-muted">Scale (risk / scorecard):</span>
          {scale.map((g) => (
            <span
              key={g}
              className={cn(
                'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-micro font-medium leading-[18px]',
                TONE_CLASS[gradeTone(g)],
              )}
            >
              <span className="font-numeric font-semibold">{g}</span>
              <span className="font-normal">
                · {RISK_WORD[g]} / {SCORE_WORD[g]?.toLowerCase()}
              </span>
            </span>
          ))}
          <span
            className={cn(
              'inline-flex items-center rounded-pill px-2 py-0.5 text-micro font-medium leading-[18px]',
              TONE_CLASS.neutral,
            )}
          >
            Not graded yet
          </span>
        </div>
      </dl>
    </details>
  );
}

// ── Category labels ──────────────────────────────────────────────────────────

/**
 * Vendor categories are tenant data: the row carries the key ("RAW_MATERIALS")
 * and the tenant's settings hold the display name. Falls back to a humanised
 * key for a category that has since been retired from the settings list.
 */
export function useCategoryLabel(): (key: string | null | undefined) => string | null {
  const { data } = useVendorCategoryOptions();
  const byKey = useMemo(
    () => new Map((data ?? []).map((c) => [c.key, c.displayName])),
    [data],
  );
  return useCallback(
    (key: string | null | undefined) => (key ? (byKey.get(key) ?? humanise(key)) : null),
    [byKey],
  );
}
