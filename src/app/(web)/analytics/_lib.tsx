'use client';

import type { AnalyticsPeriodKey, MsmeBucketKey } from '@/lib/shared';
import { RefreshCw } from 'lucide-react';
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

/** Recharts tooltips are unstyled by default and clash with the panel. */
export const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid #D4DEEC',
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
    <div className="border-line flex items-center gap-0.5 rounded-md border p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={
            'rounded px-2.5 py-1 text-caption font-medium ' +
            (value === p.key
              ? 'bg-accent-wash text-accent-2'
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
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh analytics"
          className="hover:text-accent-2 disabled:opacity-40"
        >
          <RefreshCw className={'h-3 w-3 ' + (refreshing ? 'animate-spin' : '')} />
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
