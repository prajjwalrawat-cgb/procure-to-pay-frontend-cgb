'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * Button variants.
 *
 * `commit` is the gold one, and it is the only gold control in the system. It
 * means "this action moves money or commits the company" — approve, award,
 * release a payment run, issue a PO. Naming it for the consequence rather than
 * the colour is deliberate: `variant="commit"` on a filter dropdown reads wrong
 * at the call site, where `variant="gold"` would not. Gold used decoratively
 * costs it its meaning everywhere else, so there is no gold escape hatch here.
 *
 * Focus is handled globally by the :focus-visible outline in styles.css, so
 * these classes no longer carry their own ring — one focus treatment, applied
 * consistently, that also survives dense tables and overflow containers.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-[13px] font-medium transition-colors duration-hover disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border border-line bg-panel text-text hover:bg-canvas',
        primary: 'bg-navy text-on-navy hover:bg-navy-2',
        commit: 'bg-gold-ink text-white hover:bg-gold-ink/90 shadow-xs',
        accent: 'bg-accent text-white hover:bg-accent-2',
        danger: 'bg-danger text-white hover:bg-danger/90',
        ghost: 'text-text hover:bg-canvas',
        // For chrome — sits on the navy sidebar/topbar rather than on ice.
        onNavy: 'text-on-navy-muted hover:bg-navy-3 hover:text-on-navy',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 px-2.5 text-[12px]',
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
