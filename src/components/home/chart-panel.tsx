'use client';

import { Card, CardHeader, CardTitle, EmptyState, ErrorState, Skeleton } from '@/components/ui';

/**
 * The frame both home charts sit in: title + one right-hand annotation, then
 * the plot, a skeleton, an error, or a "No data yet" state. The empty state is
 * the important one — a new tenant's all-zero series would otherwise render as
 * a correctly scaled, completely blank grid, which reads as a broken chart.
 */
export function ChartPanel({
  title,
  subtitle,
  annotation,
  isLoading,
  error,
  isEmpty,
  emptyDetail,
  onRetry,
  legend,
  children,
}: {
  title: string;
  subtitle?: string;
  annotation?: React.ReactNode;
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyDetail: string;
  onRetry?: () => void;
  legend?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  const ready = !isLoading && !error && !isEmpty;
  return (
    <Card className="min-w-0">
      <CardHeader badge={ready ? annotation : undefined} className="pb-2">
        <CardTitle>{title}</CardTitle>
        {subtitle && <span className="text-muted text-caption">{subtitle}</span>}
      </CardHeader>
      <div className="px-4 pb-4">
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : error ? (
          <div className="flex h-[220px] items-center justify-center">
            <ErrorState error={error} onRetry={onRetry} compact />
          </div>
        ) : isEmpty ? (
          <div className="flex h-[220px] items-center justify-center">
            <EmptyState compact title="No data yet" detail={emptyDetail} />
          </div>
        ) : (
          <>
            {legend}
            {children}
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * Recharts tooltip body in the design system's surface and text tokens. Values
 * stay in ink; the coloured key beside each row carries series identity.
 */
export function ChartTooltipBody({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; value: string; color?: string; strong?: boolean }[];
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel shadow-xs min-w-[160px] rounded-md border px-3 py-2 text-caption">
      <div className="text-muted mb-1 font-medium">{title}</div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="text-text flex items-center gap-1.5">
            {r.color && (
              <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: r.color }} />
            )}
            {r.label}
          </span>
          <span className={r.strong ? 'text-ink font-semibold' : 'text-ink'}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
