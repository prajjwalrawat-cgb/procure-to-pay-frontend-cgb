'use client';

import { Button, Pill } from '@/components/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { RequisitionCardView, RequisitionKanbanColumn } from '@/lib/shared';

import {
  useRequisitionBoard,
  useRequisitionList,
  type RequisitionTab,
} from '@/lib/api/requisitions';
import { inr, statusLabel, statusVariant } from '@/lib/format';
import { priorityVariant } from '@/lib/refs';
import { tenantSuffix, useTenantName } from '@/store/session-store';
import { useToastStore } from '@/store/toast-store';

const COLUMNS: {
  key: RequisitionKanbanColumn;
  label: string;
  dot: string;
}[] = [
  { key: 'DRAFT', label: 'Draft', dot: 'bg-faint' },
  { key: 'AWAITING_APPROVAL', label: 'Awaiting approval', dot: 'bg-warn' },
  { key: 'SOURCING', label: 'Sourcing', dot: 'bg-info' },
  { key: 'PO_ISSUED', label: 'PO issued', dot: 'bg-violet' },
  { key: 'RECEIVED', label: 'Received', dot: 'bg-accent' },
];

const TABS: { key: RequisitionTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'my_approval', label: 'My approval' },
  { key: 'draft', label: 'Draft' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'closed', label: 'Closed' },
];

const ORDER_KEY = 'pf_pr_board_order';

type BoardOrder = Partial<Record<RequisitionKanbanColumn, string[]>>;

export default function RequisitionsPage(): React.JSX.Element {
  const tenantName = useTenantName();
  const [tab, setTab] = useState<RequisitionTab>('active');

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            Requisitions
          </h1>
          <p className="text-muted text-[13px]">Purchase requests{tenantSuffix(tenantName)}</p>
        </div>
        <Link href="/requisitions/new">
          <Button variant="primary" size="sm">
            New requisition
          </Button>
        </Link>
      </div>

      <div className="border-line mb-4 flex items-center gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'duration-hover border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ' +
              (tab === t.key
                ? 'border-accent text-ink'
                : 'text-muted hover:text-text border-transparent')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'active' ? <Board /> : <ListView tab={tab} />}
    </div>
  );
}

function Board(): React.JSX.Element {
  const { data, isLoading } = useRequisitionBoard();
  const toast = useToastStore((s) => s.push);
  const [order, setOrder] = useState<BoardOrder>({});
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (raw) setOrder(JSON.parse(raw) as BoardOrder);
    } catch {
      /* ignore malformed local state */
    }
  }, []);

  const persist = (next: BoardOrder): void => {
    setOrder(next);
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable */
    }
  };

  const sortColumn = (
    col: RequisitionKanbanColumn,
    cards: RequisitionCardView[],
  ): RequisitionCardView[] => {
    const saved = order[col];
    if (!saved) return cards;
    const rank = new Map(saved.map((id, i) => [id, i]));
    return [...cards].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  };

  const onDrop = (
    col: RequisitionKanbanColumn,
    targetId: string,
    cards: RequisitionCardView[],
  ): void => {
    if (!dragId || dragId === targetId) return;
    const inColumn = cards.some((c) => c.id === dragId);
    if (!inColumn) {
      toast('Cannot move — use lifecycle actions', 'info');
      setDragId(null);
      return;
    }
    const ids = sortColumn(col, cards).map((c) => c.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    persist({ ...order, [col]: ids });
    setDragId(null);
  };

  if (isLoading) {
    return <div className="text-muted p-6 text-[13px]">Loading board…</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {COLUMNS.map((col) => {
        const cards = sortColumn(col.key, data?.columns[col.key] ?? []);
        const count = data?.counts[col.key] ?? cards.length;
        return (
          <div key={col.key} className="flex flex-col">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              <span className="text-text text-[12px] font-semibold uppercase tracking-wide">
                {col.label}
              </span>
              <span className="font-numeric text-faint ml-auto text-[12px]">{count}</span>
            </div>
            <div
              className="bg-canvas/40 flex min-h-[120px] flex-col gap-2 rounded-lg p-1.5"
              onDragOver={(e) => e.preventDefault()}
            >
              {cards.map((card) => (
                <BoardCard
                  key={card.id}
                  card={card}
                  onDragStart={() => setDragId(card.id)}
                  onDrop={() => onDrop(col.key, card.id, cards)}
                />
              ))}
              {cards.length === 0 && (
                <div className="text-faint px-2 py-6 text-center text-[12px]">
                  Nothing here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BoardCard({
  card,
  onDragStart,
  onDrop,
}: {
  card: RequisitionCardView;
  onDragStart: () => void;
  onDrop: () => void;
}): React.JSX.Element {
  return (
    <Link
      href={`/requisitions/${card.id}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className="border-line bg-panel hover:border-accent/50 block cursor-grab rounded-lg border p-3 active:cursor-grabbing"
    >
      <div className="flex items-center justify-between">
        <span className="font-numeric text-ink text-[12px] font-medium">
          {card.number}
        </span>
        <Pill variant={priorityVariant(card.priority)}>{card.priority}</Pill>
      </div>
      <div className="text-text mt-1 line-clamp-2 text-[13px] font-medium">
        {card.title}
      </div>
      <div className="text-muted mt-1 text-[11px]">
        {card.costCenter.code} · {card.costCenter.name}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-numeric text-ink text-[13px] font-semibold">
          {inr(card.totalAmount)}
        </span>
        <span className="font-numeric text-faint text-[11px]">{card.agingDays}d</span>
      </div>
      {card.hasMsmeVendor && (
        <Pill variant="violet" className="mt-2">
          MSME vendor
        </Pill>
      )}
    </Link>
  );
}

function ListView({ tab }: { tab: RequisitionTab }): React.JSX.Element {
  const { data, isLoading } = useRequisitionList(tab);
  const rows = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="border-line bg-panel overflow-hidden rounded-lg border">
      <table className="w-full text-[13px]">
        <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 font-medium">Requisition</th>
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Cost centre</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">Aging</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={7} className="text-muted px-3 py-8 text-center">
                Loading…
              </td>
            </tr>
          )}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-muted px-3 py-8 text-center">
                No requisitions in this view.
              </td>
            </tr>
          )}
          {rows.map((pr) => (
            <tr key={pr.id} className="border-line hover:bg-canvas/60 border-t">
              <td className="px-3 py-2">
                <Link
                  href={`/requisitions/${pr.id}`}
                  className="font-numeric text-ink font-medium"
                >
                  {pr.number}
                </Link>
              </td>
              <td className="text-text px-3 py-2">{pr.title}</td>
              <td className="text-muted px-3 py-2 text-[12px]">
                {pr.costCenter.code} · {pr.costCenter.name}
              </td>
              <td className="px-3 py-2">
                <Pill variant={statusVariant(pr.status)} dot>
                  {statusLabel(pr.status)}
                </Pill>
              </td>
              <td className="px-3 py-2">
                <Pill variant={priorityVariant(pr.priority)}>{pr.priority}</Pill>
              </td>
              <td className="font-numeric text-text px-3 py-2">{pr.agingDays}d</td>
              <td className="font-numeric text-ink px-3 py-2 text-right font-medium">
                {inr(pr.totalAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
