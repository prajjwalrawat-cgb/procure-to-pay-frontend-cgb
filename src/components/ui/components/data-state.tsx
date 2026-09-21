'use client';

/**
 * The three states every data view needs, designed once.
 *
 * Before this, list pages hand-rolled `Loading…` / `No rows` strings inline and
 * mostly had no error branch at all — a failed fetch rendered as an empty table,
 * which reads as "you have no invoices" when it actually means "we could not
 * load your invoices". That is the worst possible failure mode for a finance
 * tool, so `error` is a required consideration here rather than an optional prop.
 *
 * Two shapes, same semantics:
 *   <DataState …>      block-level, for panels, cards and detail pages
 *   <TableState …>     renders as a <tr>/<td colSpan> inside an existing table
 */

import { RotateCw } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Button } from './button';

// ── Skeleton ────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }): React.JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        'bg-canvas relative overflow-hidden rounded-sm',
        // The shimmer is decorative; the global reduced-motion rule in
        // styles.css freezes it, and aria-hidden keeps it out of the a11y tree.
        'after:animate-shimmer after:absolute after:inset-0 after:-translate-x-full',
        'after:bg-gradient-to-r after:from-transparent after:via-white/70 after:to-transparent',
        className,
      )}
    />
  );
}

/** Skeleton rows shaped like the table they are standing in for. */
export function SkeletonRows({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}): React.JSX.Element {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-line border-t">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-3 py-3.5">
              <Skeleton
                className={cn('h-3.5', c === 0 ? 'w-24' : c === cols - 1 ? 'w-16' : 'w-32')}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Error interpretation ────────────────────────────────────────────────────

interface ErrorShape {
  status?: number;
  title?: string;
  message?: string;
}

/**
 * Turns a thrown value into something a user can act on. The status code is the
 * most useful signal we have — "you don't have permission" and "the server
 * failed" need different words and different buttons.
 */
function describeError(error: unknown): {
  title: string;
  detail: string;
  retryable: boolean;
} {
  const e = (error ?? {}) as ErrorShape;
  const status = typeof e.status === 'number' ? e.status : undefined;
  const detail = e.message || e.title || 'No further detail was returned.';

  if (status === 401 || status === 403) {
    return {
      title: "You don't have access to this",
      detail:
        status === 401
          ? 'Your session may have expired. Sign in again to continue.'
          : 'Your role does not include permission for this record. Ask an administrator if you need it.',
      retryable: false,
    };
  }
  if (status === 404) {
    // Deliberately worded for both cases. A 404 here is often not a deleted
    // record but an endpoint the server did not resolve — e.g. a `:id` route
    // registered ahead of a sibling literal route, which swallows the literal
    // one. Blaming the user's link would send people looking in the wrong place.
    return {
      title: 'Not available',
      detail:
        'The server could not find this. It may have been deleted, the link may be out of date, or this endpoint may not be available on your deployment.',
      retryable: true,
    };
  }
  if (status === 422 || status === 400) {
    return { title: 'That request was rejected', detail, retryable: false };
  }
  if (status === undefined) {
    return {
      title: "Couldn't reach the server",
      detail: 'Check your connection and try again.',
      retryable: true,
    };
  }
  return {
    title: 'Something went wrong loading this',
    detail,
    retryable: true,
  };
}

// ── Presentational blocks ───────────────────────────────────────────────────

function StateFrame({
  tone = 'neutral',
  title,
  detail,
  action,
  compact,
}: {
  /** Accepted for call-site compatibility; empty states no longer draw one. */
  icon?: React.ElementType;
  tone?: 'neutral' | 'danger';
  title: string;
  detail?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-1.5 px-4 py-8' : 'gap-2 px-6 py-12',
      )}
    >
      <p
        className={cn(
          'font-medium',
          compact ? 'text-body-sm' : 'text-body',
          tone === 'danger' ? 'text-danger' : 'text-ink',
        )}
      >
        {title}
      </p>
      {detail && (
        <p className="text-muted max-w-[52ch] text-caption leading-relaxed">{detail}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  detail?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ElementType;
  compact?: boolean;
}

export function EmptyState({
  title,
  detail,
  action,
  compact,
}: EmptyStateProps): React.JSX.Element {
  return <StateFrame title={title} detail={detail} action={action} compact={compact} />;
}

export function ErrorState({
  error,
  onRetry,
  compact,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}): React.JSX.Element {
  const { title, detail, retryable } = describeError(error);
  return (
    <div role="alert">
      <StateFrame
        tone="danger"
        title={title}
        detail={detail}
        compact={compact}
        action={
          retryable && onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              <RotateCw className="h-3.5 w-3.5" aria-hidden /> Try again
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

// ── The two wrappers pages actually use ─────────────────────────────────────

export interface DataStateProps {
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  /** Shown when `isEmpty`. A bare string is treated as the title. */
  empty?: EmptyStateProps | string;
  /** Custom loading content; defaults to a stack of skeleton bars. */
  loading?: React.ReactNode;
  compact?: boolean;
  children: React.ReactNode;
}

export function DataState({
  isLoading,
  error,
  isEmpty,
  onRetry,
  empty,
  loading,
  compact,
  children,
}: DataStateProps): React.JSX.Element {
  if (isLoading) {
    return (
      <>
        {loading ?? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true" aria-live="polite">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        )}
      </>
    );
  }
  if (error) return <ErrorState error={error} onRetry={onRetry} compact={compact} />;
  if (isEmpty) {
    const props: EmptyStateProps =
      typeof empty === 'string' ? { title: empty } : (empty ?? { title: 'Nothing here yet' });
    return <EmptyState {...props} compact={compact} />;
  }
  return <>{children}</>;
}

export interface TableStateProps extends Omit<DataStateProps, 'children' | 'loading'> {
  colSpan: number;
  /** Number of skeleton rows to show while loading. */
  skeletonRows?: number;
}

/**
 * The same three states, rendered as table rows. Returns `null` when there is
 * content to show, so callers can drop it in above their `rows.map(…)` without
 * restructuring the table:
 *
 *   <tbody>
 *     <TableState colSpan={7} isLoading={…} error={…} isEmpty={!rows.length} … />
 *     {rows.map(…)}
 *   </tbody>
 */
export function TableState({
  colSpan,
  isLoading,
  error,
  isEmpty,
  onRetry,
  empty,
  skeletonRows = 5,
}: TableStateProps): React.JSX.Element | null {
  if (isLoading) return <SkeletonRows rows={skeletonRows} cols={colSpan} />;
  if (!error && !isEmpty) return null;
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        {error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : (
          <EmptyState
            {...(typeof empty === 'string'
              ? { title: empty }
              : (empty ?? { title: 'Nothing here yet' }))}
          />
        )}
      </td>
    </tr>
  );
}
