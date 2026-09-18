'use client';

import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface StepIndicatorProps {
  steps: readonly string[];
  /** Zero-based index of the step the user is on. */
  current: number;
  /** Jump back to a completed step. Omitted steps are not clickable. */
  onStepClick?: (index: number) => void;
  className?: string;
}

/**
 * The wizard step indicator, shared by the four multi-step forms (new PO, new
 * GRN, new contract, new requisition).
 *
 * Each of them had its own version, and they disagreed on everything: the
 * separator (a middle dot in two of them), the colour of the current step
 * (ink in one, accent in another) and whether completed steps were
 * distinguishable from future ones at all.
 *
 * Three states, in the redesign's one accent:
 *   done    — accent tint, tick. You can click back to it.
 *   current — filled accent. Exactly one at a time.
 *   future  — faint. Not yet reachable, and it says so by being quiet rather
 *             than by looking disabled.
 *
 * The connector is a rule, not a punctuation mark: it says the steps are a
 * sequence, which is the thing a middle dot cannot say.
 */
export function StepIndicator({
  steps,
  current,
  onStepClick,
  className,
}: StepIndicatorProps): React.JSX.Element {
  return (
    <ol className={cn('pf-scroll-x flex items-center gap-1', className)}>
      {steps.map((label, i) => {
        const done = i < current;
        const isCurrent = i === current;
        const clickable = done && onStepClick;

        const content = (
          <span className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold',
                isCurrent
                  ? 'bg-accent text-white'
                  : done
                    ? 'bg-accent-wash text-accent'
                    : 'bg-canvas text-faint',
              )}
            >
              {done ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                'whitespace-nowrap text-[13px]',
                isCurrent ? 'text-accent font-medium' : done ? 'text-text' : 'text-faint',
              )}
            >
              {label}
            </span>
          </span>
        );

        return (
          <li key={label} className="flex items-center gap-1">
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick(i)}
                className="rounded-sm"
                aria-label={`Back to step ${i + 1}, ${label}`}
              >
                {content}
              </button>
            ) : (
              <span aria-current={isCurrent ? 'step' : undefined}>{content}</span>
            )}
            {i < steps.length - 1 ? (
              <span aria-hidden className="bg-line mx-2 h-px w-6 shrink-0" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
