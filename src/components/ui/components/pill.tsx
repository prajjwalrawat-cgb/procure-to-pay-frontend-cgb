import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * Status — rendered as coloured text, not as a filled pill.
 *
 * This is the single biggest change in the redesign, and it is made here
 * rather than in ~70 screens: `<Pill>` was the status control everywhere, so
 * changing what a Pill *is* migrates the whole app at once.
 *
 * Why text and not a pill: the filled pill shape is now reserved for two
 * things only — the active nav tab, and trust/classification badges. When
 * every "Approved", "Pending QC" and "Partially received" in a 40-row table is
 * also a filled pill, the eye reads a page of coloured blocks and the actual
 * navigation state stops standing out. Colour still carries the meaning; the
 * shape no longer competes.
 *
 * The dot is on by default in tables because colour alone is not an accessible
 * signal — the label is always present, and the dot gives the colour a
 * consistent anchor point down the column.
 *
 * Variants map onto the three semantic states plus neutral. `info` and
 * `violet` used to be two more decorative hues; they collapse to neutral,
 * because "in flight" and "on hold" are not good or bad, they are just where
 * the record currently is.
 */
const pillVariants = cva('inline-flex items-center gap-1.5 text-[12px] font-medium', {
  variants: {
    variant: {
      success: 'text-success',
      danger: 'text-danger',
      warn: 'text-warn',
      /** Neutral / in-flight — no judgement attached. */
      neutral: 'text-muted',
      info: 'text-muted',
      violet: 'text-muted',
      gray: 'text-muted',
      dark: 'text-faint',
      outline: 'text-faint',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

const dotColor: Record<NonNullable<PillProps['variant']>, string> = {
  success: 'bg-success-solid',
  danger: 'bg-danger-solid',
  warn: 'bg-warn-solid',
  neutral: 'bg-faint-line',
  info: 'bg-faint-line',
  violet: 'bg-faint-line',
  gray: 'bg-faint-line',
  dark: 'bg-faint-line',
  outline: 'bg-faint-line',
};

export interface PillProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof pillVariants> {
  dot?: boolean;
}

export function StatusText({
  className,
  variant = 'neutral',
  dot = true,
  children,
  ...props
}: PillProps): React.JSX.Element {
  return (
    <span className={cn(pillVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          aria-hidden
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            dotColor[variant ?? 'neutral'],
          )}
        />
      )}
      {children}
    </span>
  );
}

/**
 * `Pill` is the name ~70 screens already import. It is the same component —
 * kept as an alias so the redesign lands everywhere at once rather than
 * screen by screen. New work should say `StatusText`, which describes what it
 * renders.
 */
export const Pill = StatusText;

export { pillVariants };
