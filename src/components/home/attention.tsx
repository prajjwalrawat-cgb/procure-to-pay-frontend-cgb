'use client';

import { Card, CardHeader, CardTitle, Skeleton, cn } from '@/components/ui';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { isForbidden } from './queries';

type Tone = 'danger' | 'warn' | 'neutral';

const TONE_DOT: Record<Tone, string> = {
  danger: 'bg-danger-solid',
  warn: 'bg-warn-solid',
  neutral: 'bg-faint-line',
};

/**
 * One "needs your attention" number that is also the way into the list behind
 * it. The dot carries urgency only when the count is non-zero — a zero is good
 * news and should read as calm, not as a grey alarm.
 */
export function AttentionTile({
  label,
  value,
  footnote,
  href,
  tone = 'neutral',
  isLoading,
  error,
}: {
  label: string;
  value: number | undefined;
  footnote?: React.ReactNode;
  href: string;
  tone?: Tone;
  isLoading?: boolean;
  error?: unknown;
}): React.JSX.Element | null {
  // Permissions changed under us: the tile is not this user's business.
  if (isForbidden(error)) return null;
  const zero = value === 0;
  return (
    <Link
      href={href}
      className="border-line bg-panel shadow-xs hover:bg-canvas duration-hover group flex flex-col rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="text-muted flex items-center gap-1.5 text-caption font-medium">
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[zero ? 'neutral' : tone])}
        />
        {label}
      </span>
      {isLoading ? (
        <Skeleton className="mt-2 h-7 w-12" />
      ) : (
        <span
          className={cn(
            'font-numeric mt-1.5 text-display font-semibold',
            zero || error ? 'text-faint' : 'text-ink',
          )}
        >
          {error ? '—' : (value ?? '—')}
        </span>
      )}
      <span className="text-muted mt-1 flex items-end justify-between gap-2 text-caption">
        <span className="min-w-0">
          {error ? 'Couldn’t load' : isLoading ? ' ' : footnote}
        </span>
        <ArrowRight
          aria-hidden
          className="text-faint group-hover:text-accent h-3.5 w-3.5 shrink-0 transition-colors"
        />
      </span>
    </Link>
  );
}

/** A card holding a short "top N" list with a link to the full view. */
export function AttentionList({
  title,
  href,
  linkLabel,
  isLoading,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  isLoading?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    // min-w-0: a grid item defaults to its min-content width, and one long
    // unbroken document id would otherwise push the card past a phone screen.
    <Card className="flex min-w-0 flex-col">
      <CardHeader
        className="border-line border-b"
        badge={
          <Link href={href} className="text-accent text-caption font-medium hover:underline">
            {linkLabel}
          </Link>
        }
      >
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      {isLoading ? (
        <div className="flex flex-col gap-3 p-4" aria-busy="true">
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

/** One row of an AttentionList: primary text, meta line, right-hand value. */
export function AttentionRow({
  href,
  primary,
  meta,
  aside,
}: {
  href: string;
  primary: React.ReactNode;
  meta?: React.ReactNode;
  aside?: React.ReactNode;
}): React.JSX.Element {
  return (
    <li>
      <Link
        href={href}
        className="hover:bg-canvas duration-hover flex items-center justify-between gap-3 px-4 py-2.5 transition-colors"
      >
        <span className="min-w-0">
          <span className="text-ink block truncate text-body-sm font-medium">{primary}</span>
          {meta && <span className="text-faint block truncate text-caption">{meta}</span>}
        </span>
        {aside && <span className="shrink-0 text-right">{aside}</span>}
      </Link>
    </li>
  );
}
