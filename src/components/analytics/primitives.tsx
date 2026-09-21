'use client';

import { Card, DataState, InfoTip, Skeleton, cn } from '@/components/ui';
import * as React from 'react';

import { inr, inrCompact } from '@/lib/format';

/**
 * Building blocks shared by the three analytics sections.
 *
 * The page's rule is that no section outweighs another, so the chrome lives
 * here once — same heading, same tile grid, same panel height — rather than
 * being restated (and drifting) per section.
 */

/** The slice of a react-query result the sections read. */
export interface Q<T> {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => unknown;
}

/** Stand-in used before the URL has been read, so nothing fetches a wrong range. */
export const PENDING: Q<never> = {
  data: undefined,
  isLoading: true,
  error: null,
  refetch: () => undefined,
};

// ── Formatting ──────────────────────────────────────────────────────────────

const oneDp = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const count = (n: number | null | undefined): string =>
  n == null ? '—' : whole.format(n);

export const pct = (n: number | null | undefined): string =>
  n == null ? '—' : `${oneDp.format(n)}%`;

export const days = (n: number | null | undefined): string =>
  n == null ? '—' : `${oneDp.format(n)} ${n === 1 ? 'day' : 'days'}`;

/**
 * Compact rupees at every size. `inrCompact` falls back to full paise below a
 * lakh, so "₹1.85 L" would sit above "₹98,000.00" in the same list.
 */
export const money = (amount: string | number): string =>
  Math.abs(Number(amount)) >= 1e5 ? inrCompact(amount) : inr(amount, 0);

/** Approval-step medians arrive in hours; past two days, days read better. */
export const hours = (h: number): string =>
  h < 48 ? `${oneDp.format(h)} h` : days(h / 24);

// ── Layout ──────────────────────────────────────────────────────────────────

export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <div>
        <h2 id={`${id}-title`} className="text-ink text-h2 font-semibold">
          {title}
        </h2>
        <p className="text-muted mt-0.5 text-caption">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** Four tiles per section, 2×2 on phones and tablets. */
export function TileRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

/**
 * Tiles have no error state of their own (they would all show "—"), so a
 * failed tile query gets one line under the row saying so, with a retry.
 */
export function TileError({
  query,
  what,
}: {
  query: Pick<Q<unknown>, 'data' | 'error' | 'refetch'>;
  what: string;
}): React.JSX.Element | null {
  if (!query.error || query.data) return null;
  return (
    <p className="text-danger text-caption" role="alert">
      Couldn&apos;t load {what}.{' '}
      <button type="button" className="font-medium underline" onClick={() => void query.refetch()}>
        Try again
      </button>
    </p>
  );
}

/** The detail row under the tiles; one or two panels, always the same height. */
export function PanelRow({
  children,
  single,
}: {
  children: React.ReactNode;
  single?: boolean;
}): React.JSX.Element {
  return (
    <div className={cn('grid grid-cols-1 gap-3', !single && 'lg:grid-cols-2')}>{children}</div>
  );
}

/**
 * A detail panel. From `lg` up the body has a fixed minimum height so the
 * panel rows of all three sections line up at the same size whatever each one
 * holds. Below that, panels stack, nothing sits beside them to match, and the
 * floor would only leave empty space.
 */
export function Panel({
  title,
  meta,
  aside,
  query,
  isEmpty,
  empty,
  children,
}: {
  title: string;
  /** One muted line under the title: basis, window, units. */
  meta?: string;
  /** Right of the title — a legend or a link. */
  aside?: React.ReactNode;
  query: Pick<Q<unknown>, 'isLoading' | 'error' | 'refetch'>;
  isEmpty: boolean;
  empty?: { title: string; detail?: string };
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card className="min-w-0 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h3 className="text-ink text-h3 font-semibold">{title}</h3>
          {meta && <p className="text-muted mt-0.5 text-caption">{meta}</p>}
        </div>
        {aside}
      </div>
      <div className="flex flex-col lg:min-h-64">
        <DataState
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          isEmpty={isEmpty}
          compact
          empty={
            empty ?? {
              title: 'No data yet',
              detail: 'Figures appear once documents are posted in the selected range.',
            }
          }
          loading={
            <div className="flex flex-col gap-4 pt-1" aria-busy="true">
              {['w-full', 'w-4/5', 'w-3/5', 'w-2/5', 'w-1/4'].map((w) => (
                <div key={w} className="flex items-center gap-3">
                  <Skeleton className="h-3.5 w-24 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className={cn('h-3', w)} />
                  </div>
                </div>
              ))}
            </div>
          }
        >
          {children}
        </DataState>
      </div>
    </Card>
  );
}

// ── Bar list ────────────────────────────────────────────────────────────────

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Text at the bar's tip, e.g. "₹1.2 Cr". */
  display: string;
  /** Second, quieter figure beside it, e.g. "34%" or "12 invoices". */
  secondary?: string;
  /** Tooltip body; defaults to label + display. */
  tip?: React.ReactNode;
  /** Tailwind background class for the bar; defaults to the accent. */
  barClass?: string;
}

/**
 * Ranked horizontal bars built from divs rather than a chart library: every
 * row carries its own label and value, so there is no axis to read, and the
 * rows wrap to label-over-bar on a phone instead of squeezing the bar to
 * nothing. Bars are thin (12px), grow from one baseline, and end in a 4px
 * rounded tip; the space between rows is the separator.
 */
export function BarList({
  data,
  ariaLabel,
}: {
  data: BarDatum[];
  ariaLabel: string;
}): React.JSX.Element {
  const max = Math.max(0, ...data.map((d) => d.value));
  return (
    <ul aria-label={ariaLabel} className="flex flex-col gap-1">
      {data.map((d) => {
        const w = max > 0 ? (d.value / max) * 100 : 0;
        return (
          <li key={d.key}>
            <InfoTip
              content={
                d.tip ?? (
                  <>
                    <span className="font-medium">{d.label}</span>: {d.display}
                    {d.secondary ? ` · ${d.secondary}` : ''}
                  </>
                )
              }
            >
              <div
                tabIndex={0}
                aria-label={`${d.label}: ${d.display}${d.secondary ? `, ${d.secondary}` : ''}`}
                className="hover:bg-canvas focus-visible:bg-canvas duration-hover grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-xs px-1.5 py-1.5 transition-colors focus-visible:outline-none sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]"
              >
                <span className="text-text truncate text-body-sm">{d.label}</span>
                <span className="order-last col-span-2 flex h-3 items-center sm:order-none sm:col-span-1">
                  <span
                    aria-hidden
                    className={cn('h-3 rounded-r-xs', d.value > 0 && 'min-w-0.5', d.barClass ?? 'bg-accent')}
                    style={{ width: `${w}%` }}
                  />
                </span>
                <span className="flex items-baseline justify-end gap-1.5 whitespace-nowrap">
                  <span className="text-ink font-numeric text-body-sm font-medium">{d.display}</span>
                  {d.secondary && (
                    <span className="text-muted font-numeric w-12 text-right text-micro">
                      {d.secondary}
                    </span>
                  )}
                </span>
              </div>
            </InfoTip>
          </li>
        );
      })}
    </ul>
  );
}
