'use client';

import type { AnalyticsPeriodKey } from '@/lib/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import type { AnalyticsRange } from '@/lib/api/analytics';

/**
 * The page's range as it sits in the URL. Custom bounds are calendar days
 * (YYYY-MM-DD) there because that is what a person reads and shares; the API
 * wants ISO datetimes, so `toApiRange` converts on the way out.
 */
export interface UrlRange {
  period: AnalyticsPeriodKey;
  from?: string;
  to?: string;
}

export const PRESETS: { key: AnalyticsPeriodKey; label: string }[] = [
  { key: 'LAST_12M', label: 'Last 12 months' },
  // The API's YTD is the Indian fiscal year to date (from 1 April), not January.
  { key: 'YTD', label: 'FY to date' },
  { key: 'LAST_24M', label: 'Last 24 months' },
  { key: 'CUSTOM', label: 'Custom' },
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT: UrlRange = { period: 'LAST_12M' };

function isPeriod(v: string | null): v is AnalyticsPeriodKey {
  return PRESETS.some((p) => p.key === v);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 1 April on or before today — the same fiscal-year start the API uses. */
export function fyStartIso(): string {
  const now = new Date();
  const y = now.getUTCMonth() < 3 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  return `${y}-04-01`;
}

function parse(search: string): UrlRange {
  const p = new URLSearchParams(search);
  const period = p.get('period');
  if (!isPeriod(period)) return DEFAULT;
  if (period !== 'CUSTOM') return { period };
  const from = p.get('from');
  const to = p.get('to');
  return {
    period,
    from: from && DAY.test(from) ? from : fyStartIso(),
    to: to && DAY.test(to) ? to : todayIso(),
  };
}

function serialise(r: UrlRange): string {
  const p = new URLSearchParams({ period: r.period });
  if (r.period === 'CUSTOM') {
    if (r.from) p.set('from', r.from);
    if (r.to) p.set('to', r.to);
  }
  return p.toString();
}

/**
 * A custom range is only sent once both ends are set and in order — a
 * half-typed date would otherwise fire a request per keystroke and flash every
 * section into an error.
 */
export function isComplete(r: UrlRange): boolean {
  if (r.period !== 'CUSTOM') return true;
  return !!r.from && !!r.to && DAY.test(r.from) && DAY.test(r.to) && r.from <= r.to;
}

export function toApiRange(r: UrlRange): AnalyticsRange {
  if (r.period !== 'CUSTOM') return { period: r.period };
  return {
    period: 'CUSTOM',
    from: r.from ? `${r.from}T00:00:00.000Z` : undefined,
    // The API treats `to` as inclusive and adds the day itself.
    to: r.to ? `${r.to}T00:00:00.000Z` : undefined,
  };
}

/** "Last 12 months", or "01/04/2026 – 21/09/2026" for a custom range. */
export function rangeLabel(r: UrlRange): string {
  if (r.period !== 'CUSTOM') return PRESETS.find((p) => p.key === r.period)?.label ?? r.period;
  const d = (s?: string) => (s ? s.split('-').reverse().join('/') : '…');
  return `${d(r.from)} – ${d(r.to)}`;
}

/**
 * Range state mirrored to `?period=…&from=…&to=…`.
 *
 * Read from `window.location` after mount rather than `useSearchParams`, which
 * forces a Suspense boundary for prerender. `ready` stays false until that read
 * so the sections don't fire a Last-12-months request only to replace it a tick
 * later with whatever the URL asked for.
 */
export function useAnalyticsRange(): {
  range: UrlRange;
  setRange: (r: UrlRange) => void;
  ready: boolean;
} {
  const router = useRouter();
  const [range, setState] = useState<UrlRange>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(parse(window.location.search));
    setReady(true);
  }, []);

  const setRange = useCallback(
    (r: UrlRange) => {
      setState(r);
      router.replace(`${window.location.pathname}?${serialise(r)}`, { scroll: false });
    },
    [router],
  );

  return { range, setRange, ready };
}
