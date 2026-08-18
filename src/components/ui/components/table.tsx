import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * Table primitives for a product that lives in tables.
 *
 * Two things are structural rather than left to each page:
 *
 *  - `numeric` on a head/cell right-aligns it and switches to tabular figures.
 *    Money and quantity columns were being aligned by hand page by page, which
 *    is why ₹ columns drifted out of alignment. Passing the prop is now the
 *    easy path and hand-rolling the classes is the hard one.
 *  - The scroll container is on the wrapper with `overflow-x-auto`, so a wide
 *    table scrolls inside itself on a narrow viewport instead of pushing the
 *    page sideways. This is what makes the tables usable on mobile at all.
 */

export const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-x-auto">
    <table
      ref={ref}
      className={cn('w-full border-collapse text-[13px]', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'bg-canvas text-faint border-line sticky top-0 z-10 border-b text-left',
      className,
    )}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <tbody ref={ref} className={className} {...props} />);
TableBody.displayName = 'TableBody';

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn('border-line hover:bg-canvas/50 duration-hover border-b transition-colors', className)}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

interface NumericCol {
  /** Right-aligns and switches to tabular figures — for money and quantities. */
  numeric?: boolean;
}

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & NumericCol
>(({ className, numeric, ...props }, ref) => (
  <th
    ref={ref}
    scope="col"
    className={cn(
      'px-3 py-2 text-[11px] font-medium uppercase tracking-wide',
      numeric && 'text-right',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & NumericCol
>(({ className, numeric, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-3 py-2', numeric && 'font-numeric text-right', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';
