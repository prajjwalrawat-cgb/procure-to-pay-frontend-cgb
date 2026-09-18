'use client';

/**
 * Honesty markers for simulated integration results.
 *
 * Several integrations (OCR extraction, sanctions screening, payment UTR,
 * GSTIN status, GSTR-2B reconciliation) return `simulated: true` when they are
 * answered by a mock provider rather than a real one. Rendering a confident
 * "CLEAR" or "ACTIVE" for one of those is a trust failure: a buyer who ships
 * goods because a sanctions screen looked clear has been misled by us.
 *
 * The obligation is unchanged. What changed is how it is said.
 *
 * The marker used to be an amber "SANDBOX" chip — a dev-state label, in
 * shouting caps, in a colour the rest of the app uses for "needs attention".
 * It told a buyer nothing they could act on and made the screen look like a
 * test harness. It now reads as what it actually means to the person looking
 * at it: the verdict beside it did not come from a real provider.
 *
 * Two rules, both still encoded here rather than left to reviewers:
 *
 *  1. A simulated result always carries the visible qualifier.
 *  2. A simulated result never keeps its semantic colour — `simulatedVariant()`
 *     drops it to neutral, so a mock "CLEAR" is not green.
 */

import * as React from 'react';

import { cn } from '../lib/cn';
import { StatusText, type PillProps } from './pill';
import { InfoTip } from './tooltip';

const EXPLAINER =
  'This result came from a simulated provider, not a live one, and carries no assurance. Connect live credentials to get a real verdict.';

export interface SandboxChipProps {
  /** Renders nothing when false, so callers can pass the flag straight through. */
  simulated?: boolean;
  /** Names the check, e.g. "sanctions screening" → "Not a live sanctions screening". */
  label?: string;
  size?: 'sm' | 'xs';
  className?: string;
}

/**
 * The qualifier itself: plain muted text, no chip, no colour. Sits beside the
 * verdict and says the one thing that changes how much weight to give it.
 */
export function SandboxChip({
  simulated = true,
  label,
  size = 'sm',
  className,
}: SandboxChipProps): React.JSX.Element | null {
  if (!simulated) return null;

  // Phrased so it composes with a verdict rather than contradicting it:
  // "Penny drop matched — not a live check" reads correctly, where "Awaiting
  // penny-drop check" beside a returned result read as a straight lie.
  const text = label ? `Not a live ${label}` : 'Not a live check';

  return (
    <InfoTip content={EXPLAINER}>
      <span
        className={cn(
          'text-muted inline-flex shrink-0 items-center whitespace-nowrap',
          size === 'xs' ? 'text-[11px]' : 'text-[12px]',
          className,
        )}
      >
        {text}
        <span className="sr-only"> — {EXPLAINER}</span>
      </span>
    </InfoTip>
  );
}

/**
 * Strips the semantic colour off a simulated result. A sandbox "CLEAR" is not
 * a pass, so it must not be rendered in the same green as a real one.
 */
export function simulatedVariant(
  variant: PillProps['variant'],
  simulated: boolean | undefined,
): PillProps['variant'] {
  return simulated ? 'neutral' : variant;
}

export interface VerificationResultProps {
  /** The verdict as the provider reported it, e.g. "Clear", "Active". */
  status: React.ReactNode;
  /** Colour the verdict would carry if it were live. */
  variant?: PillProps['variant'];
  simulated?: boolean;
  /** Names the integration, e.g. "sanctions screening". */
  label?: string;
  dot?: boolean;
  className?: string;
}

/**
 * A provider verdict rendered honestly: real results keep their state colour,
 * simulated ones go neutral and gain the qualifier. Reach for this anywhere an
 * API response carries `simulated`.
 */
export function VerificationResult({
  status,
  variant = 'neutral',
  simulated,
  label,
  dot = true,
  className,
}: VerificationResultProps): React.JSX.Element {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      <StatusText variant={simulatedVariant(variant, simulated)} dot={dot}>
        {status}
      </StatusText>
      {simulated ? (
        <SandboxChip simulated label={label} size="xs" />
      ) : null}
    </span>
  );
}

/**
 * A panel-level notice for screens whose whole content is simulated (the
 * integrations console, a reconciliation run). Use once at the top rather than
 * qualifying every row.
 *
 * Neutral, not amber: nothing here is wrong or overdue, it is a configuration
 * fact. Amber is reserved for records that need someone to act.
 */
export function SandboxBanner({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      className={cn('border-line bg-canvas rounded-lg border px-3.5 py-2.5', className)}
    >
      <p className="text-muted text-[12px] leading-relaxed">
        {children ?? (
          <>
            <span className="text-text font-medium">
              Results on this page are simulated.
            </span>{' '}
            They come from a test provider and carry no assurance. Connect live
            credentials in Integrations to get real verdicts.
          </>
        )}
      </p>
    </div>
  );
}
