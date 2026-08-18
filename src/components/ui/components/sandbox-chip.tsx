'use client';

/**
 * The sandbox marker for simulated integration results.
 *
 * Several integrations (OCR extraction, sanctions screening, payment UTR,
 * GSTIN status, GSTR-2B reconciliation) return `simulated: true` when they are
 * answered by a mock provider rather than a real one. Rendering a confident
 * green "CLEAR" or "ACTIVE" for one of those is a trust failure: a buyer who
 * ships goods because a sanctions screen looked clear has been misled by us.
 *
 * Two rules, both encoded here rather than left to reviewers:
 *
 *  1. A simulated result always carries a visible chip. `<SandboxChip />`.
 *  2. A simulated result never keeps its semantic colour. A green pill beside a
 *     small grey chip still reads as "pass" at a glance, so `simulatedVariant()`
 *     downgrades the pill to neutral and `<VerificationResult>` applies both
 *     rules together. Prefer that component over hand-assembling the pair.
 */

import { FlaskConical } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Pill, type PillProps } from './pill';
import { InfoTip } from './tooltip';

const SANDBOX_EXPLAINER =
  'Simulated result. This came from a sandbox provider, not a live one, and carries no assurance.';

export interface SandboxChipProps {
  /** Renders nothing when false, so callers can pass the flag straight through. */
  simulated?: boolean;
  /** Names the provider/operation in the tooltip, e.g. "sanctions screening". */
  label?: string;
  size?: 'sm' | 'xs';
  className?: string;
}

export function SandboxChip({
  simulated = true,
  label,
  size = 'sm',
  className,
}: SandboxChipProps): React.JSX.Element | null {
  if (!simulated) return null;

  const explainer = label
    ? `Simulated ${label}. This came from a sandbox provider, not a live one, and carries no assurance.`
    : SANDBOX_EXPLAINER;

  return (
    <InfoTip content={explainer}>
      <span
        // The text is the accessible signal; the tooltip only elaborates.
        className={cn(
          'border-warn/35 bg-warn-wash text-warn inline-flex shrink-0 items-center gap-1 rounded-xs border font-semibold uppercase tracking-wide',
          size === 'xs' ? 'px-1 py-0 text-[9px]' : 'px-1.5 py-0.5 text-[10px]',
          className,
        )}
      >
        <FlaskConical className={size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden />
        Sandbox
        <span className="sr-only"> — {explainer}</span>
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
  return simulated ? 'outline' : variant;
}

export interface VerificationResultProps {
  /** The verdict as the provider reported it, e.g. "CLEAR", "ACTIVE". */
  status: React.ReactNode;
  /** Colour the verdict would carry if it were live. */
  variant?: PillProps['variant'];
  simulated?: boolean;
  /** Names the integration in the sandbox tooltip, e.g. "sanctions screening". */
  label?: string;
  dot?: boolean;
  className?: string;
}

/**
 * A provider verdict rendered honestly: real results keep their colour,
 * simulated ones go neutral and gain the sandbox chip. This is the component
 * to reach for anywhere an API response carries `simulated`.
 */
export function VerificationResult({
  status,
  variant = 'gray',
  simulated,
  label,
  dot = true,
  className,
}: VerificationResultProps): React.JSX.Element {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      <Pill variant={simulatedVariant(variant, simulated)} dot={dot}>
        {status}
      </Pill>
      <SandboxChip simulated={simulated} label={label} />
    </span>
  );
}

/**
 * A panel-level banner for screens whose whole content is sandbox output (the
 * integrations console, a reconciliation run). Use once at the top rather than
 * chipping every row.
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
      className={cn(
        'border-warn/30 bg-warn-wash flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5',
        className,
      )}
    >
      <FlaskConical className="text-warn mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="text-warn text-[12px] leading-relaxed">
        {children ?? (
          <>
            <span className="font-semibold">Sandbox mode.</span> Results on this page come
            from simulated providers and carry no assurance. Connect live credentials to
            get real verdicts.
          </>
        )}
      </p>
    </div>
  );
}
