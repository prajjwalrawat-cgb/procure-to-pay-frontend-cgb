'use client';

import type { AnalyticsPeriodKey } from '@/lib/shared';
import { Button, DateInput, Select, cn } from '@/components/ui';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PRESETS, fyStartIso, isComplete, todayIso, type UrlRange } from './range';

/**
 * The page's one control row: range on the left, freshness and export on the
 * right. The range applies to every section at once, so it lives here and
 * nowhere else. On a phone the four presets collapse to a native select — the
 * segmented control would be wider than the screen.
 */
export function CommandBar({
  range,
  onRange,
  onExport,
  exportDisabled,
  trailing,
}: {
  range: UrlRange;
  onRange: (r: UrlRange) => void;
  onExport: () => void;
  exportDisabled: boolean;
  /** Freshness stamp / refresh, composed by the page. */
  trailing?: React.ReactNode;
}): React.JSX.Element {
  // Custom bounds are edited as a draft and only pushed up once they form a
  // valid range, so a half-typed date never reaches the URL or the API.
  const [draft, setDraft] = useState({ from: range.from ?? '', to: range.to ?? '' });
  useEffect(() => {
    if (range.period === 'CUSTOM') setDraft({ from: range.from ?? '', to: range.to ?? '' });
  }, [range.period, range.from, range.to]);

  const pick = (period: AnalyticsPeriodKey) => {
    if (period === 'CUSTOM') {
      const from = range.from ?? fyStartIso();
      const to = range.to ?? todayIso();
      onRange({ period, from, to });
    } else {
      onRange({ period });
    }
  };

  const editBound = (key: 'from' | 'to', value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    const candidate: UrlRange = { period: 'CUSTOM', ...next };
    if (isComplete(candidate)) onRange(candidate);
  };

  const draftInvalid =
    range.period === 'CUSTOM' && !isComplete({ period: 'CUSTOM', ...draft });

  return (
    <div className="border-line bg-panel mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-2">
      <Select
        aria-label="Date range"
        className="min-h-11 w-auto sm:hidden"
        value={range.period}
        onChange={(e) => pick(e.target.value as AnalyticsPeriodKey)}
      >
        {PRESETS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </Select>
      <div
        role="group"
        aria-label="Date range"
        className="border-line hidden items-center gap-0.5 rounded-md border p-0.5 sm:flex"
      >
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={range.period === p.key}
            onClick={() => pick(p.key)}
            className={cn(
              'duration-hover rounded-sm px-2.5 py-1.5 text-body-sm font-medium transition-colors',
              range.period === p.key ? 'bg-accent-wash text-accent' : 'text-muted hover:text-text',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {range.period === 'CUSTOM' && (
        <div className="flex flex-wrap items-center gap-2">
          <DateInput
            aria-label="From"
            className="min-h-11 w-auto sm:min-h-0"
            value={draft.from}
            max={draft.to || undefined}
            onChange={(e) => editBound('from', e.target.value)}
            aria-invalid={draftInvalid || undefined}
          />
          <span className="text-muted text-caption">to</span>
          <DateInput
            aria-label="To"
            className="min-h-11 w-auto sm:min-h-0"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(e) => editBound('to', e.target.value)}
            aria-invalid={draftInvalid || undefined}
          />
          {draftInvalid && (
            <span className="text-danger text-caption" role="alert">
              Pick a start date on or before the end date.
            </span>
          )}
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-3">
        {trailing}
        <Button
          variant="secondary"
          className="h-11 sm:h-9"
          onClick={onExport}
          disabled={exportDisabled}
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </Button>
      </div>
    </div>
  );
}
