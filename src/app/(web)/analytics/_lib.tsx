'use client';

import type { AnalyticsPeriodKey, MsmeBucketKey } from '@/lib/shared';
import { DataState, Skeleton, SubNav } from '@/components/ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

/**
 * The old emerald-anchored palette lived here as raw hex against the pre-refresh
 * tokens, and was never validated for colour-vision separation. Chart colour now
 * comes from the design system — see components/ui/chart-tokens.ts, which
 * records the validator output and the per-form series caps.
 *
 * Re-exported so the analytics pages have one import for chart concerns.
 */
export {
  CHART_CHROME,
  CHART_SEQUENTIAL,
  CHART_SERIES,
  CHART_STATUS,
  CHART_TICK,
} from '@/components/ui';

/**
 * Recharts tooltips are unstyled by default and clash with the panel. The
 * colours are the design-system CSS variables rather than hex, so the tooltip
 * follows the tokens instead of a copy of them.
 */
export const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid var(--pf-line)',
  background: 'var(--pf-panel)',
  color: 'var(--pf-text)',
} as const;

export const PERIODS: { key: AnalyticsPeriodKey; label: string }[] = [
  { key: 'LAST_12M', label: 'Last 12M' },
  { key: 'YTD', label: 'YTD' },
  { key: 'LAST_24M', label: '24M' },
];

export function PeriodPicker({
  value,
  onChange,
}: {
  value: AnalyticsPeriodKey;
  onChange: (v: AnalyticsPeriodKey) => void;
}): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label="Period"
      className="border-line bg-panel flex items-center gap-0.5 rounded-md border p-0.5"
    >
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          aria-pressed={value === p.key}
          onClick={() => onChange(p.key)}
          className={
            'duration-hover rounded-sm px-2.5 py-1 text-caption font-medium transition-colors ' +
            (value === p.key
              ? 'bg-accent-wash text-accent'
              : 'text-muted hover:text-text')
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'live';
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Staleness stamp for every analytics card. `refreshedAt` null → "Live". */
export function AsOfBadge({
  refreshedAt,
  onRefresh,
  refreshing,
}: {
  refreshedAt: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}): React.JSX.Element {
  const label = useMemo(() => timeAgo(refreshedAt), [refreshedAt]);
  return (
    <span className="text-faint inline-flex items-center gap-1 text-micro">
      {refreshedAt ? `Updated ${label}` : 'Live'}
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh analytics"
          aria-label="Refresh analytics"
          className="hover:text-accent disabled:opacity-40"
        >
          <RefreshCw className={'h-3 w-3 ' + (refreshing ? 'animate-spin' : '')} aria-hidden />
        </button>
      )}
    </span>
  );
}

/**
 * The statutory ladder, in the order the money travels. Shared so the overview
 * card and the MSME page name the buckets identically — the overview was
 * rendering the raw enum ("BREACH 45 PLUS").
 */
export const MSME_BUCKET_ORDER: MsmeBucketKey[] = [
  'SAFE_0_29',
  'APPROACHING_30_44',
  'BREACH_45_PLUS',
];

export const MSME_BUCKET: Record<
  MsmeBucketKey,
  { label: string; short: string; tone: 'good' | 'warn' | 'serious'; days: string }
> = {
  SAFE_0_29: { label: 'Within terms', short: 'Safe', tone: 'good', days: '0–29 days' },
  APPROACHING_30_44: {
    label: 'Approaching the cap',
    short: 'Approaching',
    tone: 'warn',
    days: '30–44 days',
  },
  BREACH_45_PLUS: {
    label: 'Past the statutory cap',
    short: 'Breach',
    tone: 'serious',
    days: '45+ days',
  },
};

/**
 * `RFQ_AWARD` → `RFQ award`, `GRN_MISSING` → `GRN missing`.
 *
 * Naive title-casing turns domain acronyms into "Rfq" and "Grn", which reads
 * as a bug to anyone in procurement, so the known ones are preserved.
 */
const ACRONYMS = new Set(['RFQ', 'PO', 'GRN', 'MSME', 'QTY', 'AP', 'GST', 'IRN']);

export function humanise(value: string): string {
  return value
    .split('_')
    .map((word, i) =>
      ACRONYMS.has(word)
        ? word
        : i === 0
          ? word.charAt(0) + word.slice(1).toLowerCase()
          : word.toLowerCase(),
    )
    .join(' ');
}

const TABS = [
  { label: 'Overview', href: '/analytics' },
  { label: 'Savings', href: '/analytics/savings' },
  { label: 'MSME', href: '/analytics/msme' },
  { label: 'AP performance', href: '/analytics/ap-performance' },
];

/**
 * The analytics views as one tab row. It sat on the overview only, so opening
 * Savings or MSME dropped the reader out of the set with a breadcrumb as the
 * only way sideways.
 */
export function AnalyticsTabs({
  active,
  className,
}: {
  active: string;
  className?: string;
}): React.JSX.Element {
  return (
    <SubNav
      className={className ?? 'mb-4'}
      aria-label="Analytics views"
      items={TABS.map((t) => ({ key: t.href, label: t.label, href: t.href }))}
      value={active}
      renderLink={(item, content) => (
        <Link key={item.key} href={item.href ?? '#'}>
          {content}
        </Link>
      )}
    />
  );
}

/** A chart panel with the three data states designed in, sized like its chart. */
export function ChartCard({
  title,
  asOf,
  className,
  query,
  isEmpty,
  height,
  empty,
  children,
}: {
  title: string;
  /** Omit to leave the staleness stamp off. */
  asOf?: string | null;
  className?: string;
  query: { isLoading: boolean; error: unknown; refetch: () => unknown };
  isEmpty: boolean;
  /** Height of the chart, so the skeleton holds the same space. */
  height: number;
  empty?: { title: string; detail?: string };
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={'border-line bg-panel min-w-0 rounded-lg border p-4 ' + (className ?? '')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-ink text-h3 font-semibold">{title}</h3>
        {asOf !== undefined && <AsOfBadge refreshedAt={asOf} />}
      </div>
      <DataState
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        isEmpty={isEmpty}
        compact
        empty={
          empty ?? {
            title: 'No data for this period',
            detail: 'Figures appear once documents are posted in the selected period.',
          }
        }
        loading={
          <div style={{ height }}>
            <Skeleton className="h-full w-full rounded-md" />
          </div>
        }
      >
        {children}
      </DataState>
    </div>
  );
}
