'use client';

import { Card, CardHeader, CardTitle, EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui';
import Link from 'next/link';

import { useUpcomingPaymentRuns } from '@/lib/api/home';
import { statusLabel, statusVariant } from '@/lib/format';

import { dayParts, inrShort } from './home-format';

/** The next three payment runs by cycle date, each linking to the run. */
export function UpcomingRuns({ enabled }: { enabled: boolean }): React.JSX.Element {
  const q = useUpcomingPaymentRuns(enabled);
  const items = (q.data?.items ?? []).slice(0, 3);

  return (
    <Card className="min-w-0">
      <CardHeader
        className="border-line border-b"
        badge={
          <Link href="/payment-runs" className="text-accent text-caption font-medium hover:underline">
            All runs
          </Link>
        }
      >
        <CardTitle>Upcoming payment runs</CardTitle>
      </CardHeader>
      {q.isLoading ? (
        <div className="flex flex-col gap-3 p-4" aria-busy="true">
          {[0, 1, 2].map((k) => (
            <Skeleton key={k} className="h-11 w-full" />
          ))}
        </div>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} compact />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          title="No runs scheduled"
          detail="Payment runs with an upcoming cycle date will appear here."
        />
      ) : (
        <ul className="divide-line divide-y py-1">
          {items.map((r) => {
            const d = dayParts(r.cycleDate);
            return (
              <li key={r.id}>
                <Link
                  href={`/payment-runs/${r.id}`}
                  className="hover:bg-canvas duration-hover flex items-center gap-3 px-4 py-2.5 transition-colors"
                >
                  <span className="border-line bg-paper flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border leading-none">
                    <span className="text-ink text-body font-semibold">{d.day}</span>
                    <span className="text-muted mt-0.5 text-micro">{d.month}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-ink block truncate text-body-sm font-medium">
                      {r.name ?? r.number}
                    </span>
                    <span className="text-faint block truncate text-caption">
                      {[r.name ? r.number : null, `${r.itemCount} ${r.itemCount === 1 ? 'invoice' : 'invoices'}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="text-ink block text-body-sm font-semibold">{inrShort(r.net)}</span>
                    <Pill variant={statusVariant(r.status)} dot>
                      {statusLabel(r.status)}
                    </Pill>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
