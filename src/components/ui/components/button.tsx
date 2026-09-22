'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * Buttons.
 *
 * Two shapes carry the whole app:
 *
 *   primary   — filled accent. ONE per screen, or one per card. If a screen
 *               has three "New X" / "Continue" actions, the most important is
 *               primary and the rest are secondary. Two filled buttons side by
 *               side means neither is the answer to "what do I do here".
 *   secondary — transparent with a hairline border. The default for everything
 *               else, including destructive-adjacent actions that still need a
 *               confirm step behind them.
 *
 * `danger` is filled red and is only for the confirm step of a destructive
 * action — never for the button that opens the dialog.
 *
 * The old `commit` (gold) and `accent` (green) variants are aliases of
 * `primary` now. The system has one accent; a second filled colour for
 * "money-moving" actions meant approve buttons and save buttons competed, and
 * the distinction was carried by hue alone, which is not an accessible signal.
 *
 * Focus is handled globally by the :focus-visible outline in styles.css.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-body-sm font-medium transition-colors duration-hover disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        /** Filled accent. One per screen. */
        primary: 'bg-accent text-white hover:bg-accent-2',
        /** Hairline border on transparent — the workhorse. */
        default: 'border border-line bg-panel text-text hover:bg-canvas',
        secondary: 'border border-line bg-transparent text-text hover:bg-canvas',
        /** No border, no fill — for toolbar and in-row actions. */
        ghost: 'text-muted hover:bg-canvas hover:text-text',
        /** Reads as a link; for "view all", "clear filters". */
        link: 'text-accent hover:text-accent-2 underline-offset-2 hover:underline px-0',
        /** Confirm step of a destructive action only. */
        danger: 'bg-danger text-white hover:bg-danger/90',

        // ── Legacy aliases ──────────────────────────────────────────────
        // Kept so un-migrated call sites keep compiling and now render as the
        // single primary rather than gold / green / navy.
        commit: 'bg-accent text-white hover:bg-accent-2',
        accent: 'bg-accent text-white hover:bg-accent-2',
        onNavy: 'text-muted hover:bg-canvas hover:text-text',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 px-2.5 text-caption',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
