'use client';

import type { SpendByCategoryResponse, SpendSavingsResponse } from '@/lib/shared';
import { KpiCard } from '@/components/ui';

import { inr } from '@/lib/format';

import {
  BarList,
  Panel,
  PanelRow,
  Section,
  TileError,
  TileRow,
  count,
  pct,
  money,
  type BarDatum,
  type Q,
} from './primitives';

/** Rows shown before the tail folds into "Other" — keeps the panel at the shared height. */
const TOP_CATEGORIES = 5;

export function categoryBars(d: SpendByCategoryResponse | undefined): BarDatum[] {
  const sorted = [...(d?.slices ?? [])].sort((a, b) => Number(b.netSpend) - Number(a.netSpend));
  const head = sorted.slice(0, TOP_CATEGORIES);
  const tail = sorted.slice(TOP_CATEGORIES);
  const rows = head.map((s) => ({ key: s.category, label: s.category, net: Number(s.netSpend), pct: s.pct }));
  if (tail.length > 0) {
    rows.push({
      key: '__other',
      label: `Other (${tail.length})`,
      net: tail.reduce((sum, s) => sum + Number(s.netSpend), 0),
      pct: tail.reduce((sum, s) => sum + s.pct, 0),
    });
  }
  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: r.net,
    display: money(r.net),
    secondary: pct(r.pct),
    tip: (
      <>
        <span className="font-medium">{r.label}</span>: {inr(r.net)} ({pct(r.pct)} of spend)
      </>
    ),
  }));
}

export function SpendSavingsSection({
  savings,
  category,
}: {
  savings: Q<SpendSavingsResponse>;
  category: Q<SpendByCategoryResponse>;
}): React.JSX.Element {
  const s = savings.data;
  const bars = categoryBars(category.data);
  return (
    <Section
      id="spend"
      title="Spend & savings"
      description="Where the money went in the selected range, and what sourcing saved."
    >
      <TileRow>
        <KpiCard
          label="Savings realized"
          isLoading={savings.isLoading}
          value={s ? money(s.savingsRealized.amount) : '—'}
          footnote={
            s
              ? `${pct(s.savingsRealized.pct)} of baseline · ${count(s.savingsRealized.count)} ${s.savingsRealized.count === 1 ? 'entry' : 'entries'}`
              : undefined
          }
          help="Confirmed savings-ledger entries in the range, against their baseline value."
        />
        <KpiCard
          label="Top-5 vendor concentration"
          isLoading={savings.isLoading}
          value={s ? pct(s.top5Concentration) : '—'}
          footnote={s ? 'Share of spend' : undefined}
          help="Share of the range's net spend that went to the five largest vendors."
        />
        <KpiCard
          label="Maverick spend"
          isLoading={savings.isLoading}
          value={s ? pct(s.maverick.pct) : '—'}
          footnote={s ? `${money(s.maverick.amount)} off-process` : undefined}
          help="Spot-buy POs, or POs with neither a contract nor a requisition behind them, as a share of PO value issued in the range."
        />
        <KpiCard
          label="RFQs awarded"
          isLoading={savings.isLoading}
          value={s ? count(s.rfqsAwarded) : '—'}
          footnote={s ? 'Awards approved' : undefined}
        />
      </TileRow>
      <TileError query={savings} what="the savings figures" />
      <PanelRow single>
        <Panel
          title="Spend by category"
          meta="Net spend, from PO line categories — invoices carry none."
          query={category}
          isEmpty={bars.every((b) => b.value === 0)}
        >
          <BarList data={bars} ariaLabel="Spend by category" />
        </Panel>
      </PanelRow>
    </Section>
  );
}
