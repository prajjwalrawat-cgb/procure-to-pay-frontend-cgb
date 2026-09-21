'use client';

import { Card, CardHeader, CardTitle, EmptyState, ErrorState, Skeleton, cn } from '@/components/ui';
import Link from 'next/link';

import { useApprovalPipeline } from '@/lib/api/home';
import { qty } from '@/lib/format';

/**
 * Requisitions and POs by approval stage, ending with what cleared in the last
 * 30 days. Stage names are the tenant's own matrix step names. Bar widths are
 * each count over the largest count in the funnel — real proportions, so a
 * stage that is piling up is visibly the long bar.
 */
export function ApprovalPipeline({ enabled }: { enabled: boolean }): React.JSX.Element {
  const q = useApprovalPipeline(enabled);
  const rows = q.data
    ? [
        ...q.data.stages.map((s) => ({ key: s.key, label: s.label, count: s.count, done: false })),
        { key: 'approved', label: 'Approved (30d)', count: q.data.approved30d, done: true },
      ]
    : [];
  const max = Math.max(0, ...rows.map((r) => r.count));

  return (
    <Card className="min-w-0">
      <CardHeader
        className="border-line border-b"
        badge={
          <Link href="/inbox" className="text-accent text-caption font-medium hover:underline">
            Open approvals
          </Link>
        }
      >
        <CardTitle>Approval pipeline</CardTitle>
        <span className="text-muted text-caption">Requisitions and purchase orders by stage</span>
      </CardHeader>
      <div className="p-4">
        {q.isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2, 3].map((k) => (
              <Skeleton key={k} className="h-6 w-full" />
            ))}
          </div>
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} compact />
        ) : max === 0 ? (
          <EmptyState
            compact
            title="No data yet"
            detail="Documents moving through approval will be counted here, stage by stage."
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {rows.map((r) => (
              <li
                key={r.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[10rem_minmax(0,1fr)_3rem]"
              >
                <span className="text-text truncate text-body-sm">{r.label}</span>
                {/* On phones the bar drops to its own full-width line under label + count. */}
                <span className="bg-accent-wash col-span-2 row-start-2 h-2.5 overflow-hidden rounded-sm sm:col-span-1 sm:row-start-auto">
                  <span
                    className={cn('block h-full rounded-sm', r.done ? 'bg-accent-2' : 'bg-accent-mid')}
                    style={{ width: r.count === 0 ? 0 : `max(4px, ${(r.count / max) * 100}%)` }}
                  />
                </span>
                <span className="text-ink col-start-2 row-start-1 text-right text-body-sm font-semibold sm:col-start-auto sm:row-start-auto">
                  {qty(r.count)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
