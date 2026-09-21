'use client';

import type { ActivityItem, ActivityKind } from '@/lib/shared';
import { Button, Card, CardHeader, CardTitle, EmptyState, ErrorState, Skeleton, cn } from '@/components/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useHomeActivity } from '@/lib/api/home';
import { formatDateTime } from '@/lib/format';

import { relativeTime } from './home-format';

/**
 * Dot per event kind. Deliberately few colours: green/red for the two
 * outcomes, amber for exceptions, the accent family for things moving forward,
 * grey for routine logistics. The title always states the event in words, so
 * the dot is a scanning aid, never the only signal.
 */
const KIND_DOT: Record<ActivityKind, string> = {
  approval: 'bg-success-solid',
  rejection: 'bg-danger-solid',
  exception: 'bg-warn-solid',
  submission: 'bg-accent',
  payment: 'bg-accent-mid',
  receipt: 'bg-faint-line',
  order: 'bg-faint-line',
};

/** Live tenant activity, newest first; polls every 45s, "Load more" pages back. */
export function ActivityFeed({
  enabled,
  className,
}: {
  enabled: boolean;
  className?: string;
}): React.JSX.Element {
  const q = useHomeActivity(enabled);
  // Re-render relative times once a minute so "just now" doesn't go stale.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Card className={cn('flex min-w-0 flex-col', className)}>
      <CardHeader className="border-line border-b">
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      {q.isLoading ? (
        <div className="flex flex-col gap-3 p-4" aria-busy="true">
          {[0, 1, 2, 3, 4].map((k) => (
            <Skeleton key={k} className="h-9 w-full" />
          ))}
        </div>
      ) : q.error && items.length === 0 ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} compact />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          title="No activity yet"
          detail="Approvals, submissions, receipts and payments across your organisation will appear here as they happen."
        />
      ) : (
        <>
          {/* Capped height so a busy day doesn't push the row far below its neighbours. */}
          <ul className="divide-line max-h-[420px] divide-y overflow-y-auto py-1">
            {items.map((i) => (
              <ActivityRow key={i.id} item={i} now={now} />
            ))}
          </ul>
          {q.hasNextPage && (
            <div className="border-line mt-auto border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 w-full sm:min-h-0"
                onClick={() => void q.fetchNextPage()}
                disabled={q.isFetchingNextPage}
              >
                {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ActivityRow({ item, now }: { item: ActivityItem; now: number }): React.JSX.Element {
  const body = (
    <>
      <span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', KIND_DOT[item.kind])} />
      <span className="min-w-0 flex-1">
        <span className="text-ink block truncate text-body-sm font-medium">{item.title}</span>
        {item.detail && <span className="text-faint block truncate text-caption">{item.detail}</span>}
      </span>
      <time
        dateTime={item.at}
        title={formatDateTime(item.at)}
        className="text-faint shrink-0 whitespace-nowrap text-caption"
      >
        {relativeTime(item.at, now)}
      </time>
    </>
  );
  const cls = 'flex items-start gap-3 px-4 py-2.5';
  return (
    <li>
      {item.href ? (
        <Link href={item.href} className={cn(cls, 'hover:bg-canvas duration-hover transition-colors')}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}
