import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * Badges — trust and classification signals only.
 *
 * MSME, Verified, Risk grade, "Rate contract". Things that are true *about* a
 * record permanently, not where it is in a workflow. Workflow position is
 * status, and status is coloured text in a table (see <StatusText>) — a filled
 * pill for status competes with the nav pill, which is the one place in the
 * app where a filled pill means "you are here".
 *
 * Two variants, and only two. Every badge in the product maps to one of them:
 *
 *   classification — neutral fact about the record (MSME, GST registered,
 *                    rate contract). Accent tint.
 *   signal         — a positive or negative assessment (Verified, Blacklisted,
 *                    Expiring). Semantic state colour.
 *
 * There is deliberately no way to add a seventh hue here. The old system grew
 * a colour per category — violet MSME, orange priority, green verified — and
 * the result was that colour told you nothing.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium leading-[18px] whitespace-nowrap',
  {
    variants: {
      variant: {
        /** Neutral classification — the default. */
        classification: 'bg-accent-wash text-accent',
        /** Positive signal — verified, compliant, on contract. */
        positive: 'bg-success-bg text-success',
        /** Cautionary signal — expiring, incomplete. */
        caution: 'bg-warn-bg text-warn',
        /** Negative signal — blacklisted, breached, blocked. */
        negative: 'bg-danger-bg text-danger',
        /** No colour at all — for a fact that carries no judgement. */
        neutral: 'bg-canvas text-muted',
        outline: 'border-line text-muted border bg-transparent',

        // Legacy aliases so un-migrated call sites keep compiling.
        default: 'bg-canvas text-muted',
        accent: 'bg-accent-wash text-accent',
      },
    },
    defaultVariants: { variant: 'classification' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Small leading icon — Lucide component, rendered at 12px. */
  icon?: React.ElementType;
}

export function Badge({
  className,
  variant,
  icon: Icon,
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
      {children}
    </span>
  );
}

export { badgeVariants };
