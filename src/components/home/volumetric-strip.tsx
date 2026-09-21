'use client';

import type { HomeSummaryResponse, HomeTile } from '@/lib/shared';
import { CHART_SERIES, CHART_SEQUENTIAL, InfoTip, Skeleton, cn } from '@/components/ui';
import { useState } from 'react';

import { qty } from '@/lib/format';

import { dayLabel, deltaText, inrShort } from './home-format';

type TileKey = keyof HomeSummaryResponse['tiles'];

interface TileDef {
  key: TileKey;
  label: string;
  /** Formats the headline and each sparkline point the same way. */
  format: (v: number) => string;
  help?: string;
}

const money = (v: number): string => inrShort(v);
const count = (v: number): string => qty(v);
const pct = (v: number): string => `${Math.round(v)}%`;

const TILES: TileDef[] = [
  { key: 'spendMtd', label: 'Spend MTD', format: money, help: 'Net invoice value received this month to date.' },
  { key: 'openPos', label: 'Open POs', format: count },
  { key: 'invoicesInFlight', label: 'Invoices in flight', format: count, help: 'Received but not yet fully paid or rejected.' },
  { key: 'activeVendors', label: 'Active vendors', format: count },
  { key: 'paymentRunsThisWeek', label: 'Payment runs this week', format: count },
  {
    key: 'msmeComplianceScore',
    label: 'MSME compliance',
    format: pct,
    help: 'Share of MSME invoices due in the last 90 days that were paid by their 45-day due date (MSMED Act §15).',
  },
];

/** Fewer points than this is a stub, not a trend — the tile shows the headline alone. */
const MIN_SPARK_POINTS = 3;

/**
 * The six "how big is the operation right now" numbers. Each is a stat tile:
 * headline, a small trend line from the same rollup, and a delta against the
 * comparison window the API names. Nothing here is a call to action, so the
 * tiles are not links — the needs-attention grid below is where you click.
 */
export function VolumetricStrip({
  data,
  isLoading,
  error,
}: {
  data: HomeSummaryResponse | undefined;
  isLoading: boolean;
  error: unknown;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {TILES.map((def) =>
        isLoading ? (
          <TileSkeleton key={def.key} />
        ) : (
          <StatTile
            key={def.key}
            def={def}
            tile={data?.tiles[def.key]}
            failed={!!error}
            footnote={
              def.key === 'paymentRunsThisWeek' && data
                ? `${inrShort(data.tiles.paymentRunsThisWeek.amount)} net`
                : undefined
            }
          />
        ),
      )}
    </div>
  );
}

function TileSkeleton(): React.JSX.Element {
  return (
    <div className="border-line bg-panel rounded-lg border p-3.5" aria-busy="true">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2.5 h-6 w-16" />
      <Skeleton className="mt-3 h-7 w-full" />
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  );
}

function headlineNumber(v: HomeTile['value']): number | null {
  if (v === null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function StatTile({
  def,
  tile,
  failed,
  footnote,
}: {
  def: TileDef;
  tile: HomeTile | undefined;
  failed: boolean;
  footnote?: string;
}): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null);
  const value = tile ? headlineNumber(tile.value) : null;
  const trend = tile?.trend ?? [];
  const hasSpark = trend.length >= MIN_SPARK_POINTS;
  const delta = tile ? deltaText(tile.deltaPct, tile.deltaBasis) : null;
  const hovered = hover !== null ? trend[hover] : undefined;

  return (
    <div className="border-line bg-panel flex min-w-0 flex-col rounded-lg border p-3.5">
      <span className="text-muted flex items-center gap-1.5 text-caption font-medium">
        <span className="truncate">{def.label}</span>
        {def.help && (
          <InfoTip content={def.help}>
            <button
              type="button"
              aria-label={`How ${def.label} is calculated`}
              className="border-line text-faint hover:text-ink duration-hover flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-micro font-semibold transition-colors"
            >
              ?
            </button>
          </InfoTip>
        )}
      </span>
      <span
        className={cn(
          'mt-1 text-h1 font-semibold',
          value === null ? 'text-faint' : 'text-ink',
        )}
      >
        {failed || value === null ? '—' : def.format(value)}
      </span>

      {/* Fixed-height slot so a tile without a trend lines up with its neighbours. */}
      <div className="mt-2 h-8">
        {hasSpark && !failed && (
          <Sparkline
            points={trend.map((p) => p.value)}
            hover={hover}
            onHover={setHover}
            label={`${def.label}, last ${trend.length} days`}
          />
        )}
      </div>

      <span className="text-muted mt-1.5 truncate text-caption">
        {failed
          ? 'Couldn’t load'
          : hovered
            ? `${dayLabel(hovered.day)} · ${def.format(hovered.value)}`
            : (delta ?? footnote ?? (hasSpark ? `Last ${trend.length} days` : ' '))}
      </span>
      {delta && footnote && !hovered && !failed && (
        <span className="text-faint truncate text-caption">{footnote}</span>
      )}
    </div>
  );
}

/**
 * A 2px line with its last point marked — no axes, no fill. Drawn in a viewBox
 * stretched to the slot (`preserveAspectRatio="none"`) with a non-scaling
 * stroke, so the line keeps its weight at any tile width. The dots are HTML
 * rather than SVG circles for the same reason: a stretched circle is an oval.
 *
 * Hover (or touch-drag) reads a point back into the tile's footer line.
 */
function Sparkline({
  points,
  hover,
  onHover,
  label,
}: {
  points: number[];
  hover: number | null;
  onHover: (i: number | null) => void;
  label: string;
}): React.JSX.Element {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const n = points.length;
  // 2 units of headroom top and bottom so the line never grazes the slot edge.
  const x = (i: number): number => (i / (n - 1)) * 100;
  const y = (v: number): number => 30 - ((v - min) / span) * 28; // 2..30 in a 0..32 box
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  const active = hover ?? n - 1;

  return (
    <div
      className="relative h-full w-full touch-pan-y"
      role="img"
      aria-label={label}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        onHover(Math.round(f * (n - 1)));
      }}
      onPointerLeave={() => onHover(null)}
    >
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-full w-full overflow-visible">
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={0}
            y2={32}
            stroke="var(--pf-line)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={d}
          fill="none"
          stroke={CHART_SEQUENTIAL[3]}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        aria-hidden
        className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-panel"
        style={{
          left: `${x(active)}%`,
          top: `${(y(points[active] ?? 0) / 32) * 100}%`,
          background: CHART_SERIES[0],
        }}
      />
    </div>
  );
}
