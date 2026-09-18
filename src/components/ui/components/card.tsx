import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * The card.
 *
 * Cards are for comparison — vendors, RFQ responses, contracts, requisition
 * kanban cards. Anything you scan *across* rather than *down*. Transactional
 * lists (purchase orders, invoices, receipts, inventory) are tables; see
 * table.tsx.
 *
 * Structure, in order:
 *   CardHeader   — primary label (bold) on the left, at most one badge right
 *   CardContent  — the body
 *   CardFooter   — one muted metadata string left, one action right
 *
 * Separation is a hairline, never a shadow. A grid of shadowed cards on a grey
 * page reads as floating debris; the border does the same job and keeps the
 * card flush with the tables it sits beside.
 */
export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /** Adds hover feedback. Only for cards that are themselves a link/button. */
    interactive?: boolean;
  }
>(({ className, interactive, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // A flex column so CardFooter can sit on the bottom edge (`mt-auto`)
      // whatever the body height, which is what keeps a row of card footers
      // aligned across a grid.
      //
      // Deliberately NOT `h-full`. A grid cell already stretches its item, so
      // inside <CardGrid> the height comes for free — while `h-full` on a card
      // sitting in an ordinary column resolved against a stretched parent and
      // blew every card up to the height of the tallest thing beside it.
      'border-line bg-panel flex flex-col rounded-lg border',
      interactive && 'hover:border-accent/40 duration-hover transition-colors',
      className,
    )}
    {...props}
  />
));
Card.displayName = 'Card';

/**
 * Header row. Pass `badge` for the one right-aligned badge — passing it as a
 * prop rather than as children is what keeps it to one, and keeps every card
 * in a grid aligned on the same baseline.
 */
export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { badge?: React.ReactNode }
>(({ className, badge, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-start justify-between gap-3 p-4', className)}
    {...props}
  >
    <div className="flex min-w-0 flex-col gap-1">{children}</div>
    {badge ? <div className="shrink-0">{badge}</div> : null}
  </div>
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('tracking-heading text-ink truncate text-[14px] font-semibold', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

/** One line under the title. Factual, muted, 12px. */
export const CardMeta = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-muted text-[12px]', className)} {...props} />
));
CardMeta.displayName = 'CardMeta';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-4 pb-4', className)} {...props} />
));
CardContent.displayName = 'CardContent';

/**
 * Footer row: metadata left, action right. The divider is what makes a grid of
 * cards scan as a table of records rather than as loose boxes.
 */
export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { action?: React.ReactNode }
>(({ className, action, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'border-line mt-auto flex items-center justify-between gap-3 border-t px-4 py-2.5',
      className,
    )}
    {...props}
  >
    <div className="text-muted min-w-0 truncate text-[12px]">{children}</div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
));
CardFooter.displayName = 'CardFooter';

/**
 * The standard card grid. Fixed here rather than per screen so vendors,
 * contracts and sourcing all break at the same widths.
 */
export function CardGrid({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      // `auto-rows-fr` keeps every card in a row the same height, so the
      // footers form a line the eye can read across.
      className={cn('grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3', className)}
      {...props}
    />
  );
}
