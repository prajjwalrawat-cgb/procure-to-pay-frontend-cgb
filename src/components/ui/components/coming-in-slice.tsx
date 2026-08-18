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
        <h2 className="tracking-heading text-ink text-[16px] font-semibold">{name}</h2>
        <p className="text-muted mt-1 text-[13px]">
          Coming in <span className="font-numeric">Slice {number}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Marks a single control whose capability has not shipped.
 *
 * The pattern this replaces was `<span title="Coming in Slice 5.5">` wrapped
 * around a disabled button: the explanation only existed on pointer hover, so
 * on touch and for keyboard users the control was simply dead with no reason
 * given. This renders a visible "Soon" chip alongside, keeps the tooltip for
 * detail, and marks the control up so assistive tech announces why.
 *
 * Use it for anything wired to an unshipped endpoint. Never ship a live-looking
 * button that returns 501.
 */
export function NotShipped({
  children,
  reason,
  label = 'Soon',
  className,
}: {
  /** The disabled control. */
  children: React.ReactNode;
  /** Why it is not available yet, e.g. "PO amendments arrive in Slice 5.5". */
  reason: string;
  label?: string;
  className?: string;
}): React.JSX.Element {
  return (
    <InfoTip content={reason}>
      <span
        className={cn('inline-flex cursor-help items-center gap-1', className)}
        // The control inside is disabled and therefore not focusable, so the
        // description has to live on the wrapper to be reachable at all.
        role="group"
        aria-label={`${label}: ${reason}`}
      >
        {children}
        <span className="border-line bg-canvas text-faint rounded-xs border px-1 py-0 text-[9px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </span>
    </InfoTip>
  );
}
