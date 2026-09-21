import { Construction } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { InfoTip } from './tooltip';

export interface ComingInSliceProps {
  number: number;
  name: string;
}

/**
 * Placeholder for any screen not yet in scope (Master Context §1: stub, do not
 * silently implement). Rendered by every non-Slice-0 route.
 */
export function ComingInSlice({ number, name }: ComingInSliceProps): React.JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="bg-accent-wash text-accent-2 flex h-12 w-12 items-center justify-center rounded-lg">
        <Construction className="h-6 w-6" />
      </div>
      <div>
        <h2 className="tracking-heading text-ink text-h3 font-semibold">{name}</h2>
        <p className="text-muted mt-1 text-body-sm">
          Coming in <span className="font-numeric">Slice {number}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Marks a single control whose capability has not shipped.
 *
 * The control renders visibly disabled (the button's own disabled styling) and
 * the explanation lives in a tooltip on hover and keyboard focus, and in the
 * accessible name, so touch and screen-reader users get it too. There is no
 * visible "Soon" text: a raw marker beside a primary action reads as
 * unfinished UI, not as a roadmap.
 *
 * Use it for anything wired to an unshipped endpoint. Never ship a live-looking
 * button that returns 501.
 */
export function NotShipped({
  children,
  reason,
  label = 'Not available yet',
  className,
}: {
  /** The disabled control. */
  children: React.ReactNode;
  /** Why it is not available yet, e.g. "PO amendments are not available yet." */
  reason: string;
  /** Prefix for the accessible name. */
  label?: string;
  className?: string;
}): React.JSX.Element {
  return (
    <InfoTip content={reason}>
      {/* The wrapper takes focus because a disabled button cannot, which is
          what lets keyboard users reach the tooltip. */}
      <span
        tabIndex={0}
        className={cn('inline-flex cursor-not-allowed rounded-sm', className)}
        role="group"
        aria-label={`${label}: ${reason}`}
      >
        {children}
      </span>
    </InfoTip>
  );
}
