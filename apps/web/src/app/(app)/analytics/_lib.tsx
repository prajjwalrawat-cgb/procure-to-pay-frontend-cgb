'use client';

import type { AnalyticsPeriodKey } from '@procureflow/shared';
import { RefreshCw } from 'lucide-react';
import { useMemo } from 'react';

/** Emerald-anchored categorical palette (Master Context §6 accent + neutrals). */
export const CHART_COLORS = [
  '#05835C',
  '#0276B2',
  '#7C3AED',
  '#AF6005',
  '#DA1C46',
  '#0D9488',
  '#70706B',
];
export const ACCENT = '#05835C';
export const PRIOR = '#70706B';

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
            'rounded px-2.5 py-1 text-[12px] font-medium ' +
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
    <span className="text-faint inline-flex items-center gap-1 text-[11px]">
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
