import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * Table primitives for a product that lives in tables.
 *
 * Tables are the pattern for transactional lists — purchase orders, invoices,
 * goods receipt, inventory, payment runs. Anything you scan *down*. Comparison
 * views (vendors, sourcing responses, contracts) use the card grid instead.
 *
 * Four things are structural rather than left to each page:
 *
 *  - No card wrapper. A table is separated from the page by its own hairline
 *    row dividers; boxing it as well draws a second frame around a thing that
 *    already has one.
 *  - Column headers are sentence case. ALL-CAPS micro-labels were the single
 *    loudest piece of chrome in the old UI and they compete with the data.
 *  - `numeric` on a head/cell right-aligns it and switches to tabular figures.
 *    Money and quantity columns were being aligned by hand page by page, which
 *    is why ₹ columns drifted. Passing the prop is now the easy path.
 *  - The scroll container is on the wrapper with `overflow-x-auto`, so a wide
 *    table scrolls inside itself instead of pushing the page sideways.
 */

export const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-x-auto">
    <table
      ref={ref}
      className={cn('pf-stack w-full border-collapse text-body-sm', className)}
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
      // No fill: the header is separated from the rows by its hairline, and a
      // grey band across the top of every list re-introduces the boxed look.
      'bg-panel text-muted border-line sticky top-0 z-10 border-b text-left',
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
    className={cn(
      'border-line hover:bg-canvas/60 duration-hover border-b transition-colors',
      className,
    )}
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
      'px-3 py-2.5 text-caption font-medium',
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
    className={cn('px-3 py-3.5', numeric && 'font-numeric text-right', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';
