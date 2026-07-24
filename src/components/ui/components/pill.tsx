import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/cn';

// Pill variants locked from v6 (Master Context §6): success, danger, warn,
// info, violet, gray, dark, outline — all with an optional leading dot.
const pillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-[11px] font-medium leading-none',
  {
    variants: {
      variant: {
        success: 'bg-accent-wash text-accent-2',
        danger: 'bg-danger-wash text-danger',
        warn: 'bg-warn-wash text-warn',
        info: 'bg-info-wash text-info',
        violet: 'bg-violet-wash text-violet',
        gray: 'bg-canvas text-muted',
        dark: 'bg-ink text-white',
        outline: 'border border-line text-muted',
      },
    },
    defaultVariants: { variant: 'gray' },
  },
);

const dotColor: Record<NonNullable<PillProps['variant']>, string> = {
  success: 'bg-accent',
  danger: 'bg-danger',
  warn: 'bg-warn',
  info: 'bg-info',
  violet: 'bg-violet',
  gray: 'bg-faint',
  dark: 'bg-white',
  outline: 'bg-faint',
};

export interface PillProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof pillVariants> {
  dot?: boolean;
}

export function Pill({
  className,
  variant = 'gray',
  dot = false,
  children,
  ...props
}: PillProps): React.JSX.Element {
  return (
    <span className={cn(pillVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotColor[variant ?? 'gray'])}
        />
      )}
      {children}
    </span>
  );
}
