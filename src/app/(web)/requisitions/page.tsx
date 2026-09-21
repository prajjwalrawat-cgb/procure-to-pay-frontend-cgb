'use client';

import {
  Badge,
  Button,
  DataState,
  PageHeader,
  Pill,
  Skeleton,
  SubNav,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableState,
} from '@/components/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { RequisitionCardView, RequisitionKanbanColumn } from '@/lib/shared';

import {
  useRequisitionBoard,
  useRequisitionList,
  type RequisitionTab,
} from '@/lib/api/requisitions';
import { inr, statusLabel, statusVariant } from '@/lib/format';
import { priorityLabel, priorityVariant } from '@/lib/refs';
import { useToastStore } from '@/store/toast-store';

/**
 * The board columns.
 *
 * Only two dots carry colour: "Awaiting approval", because a request stalled
 * on a person is the one column that needs someone to act, and "Received",
 * because it is the finish line. The three in between are stages of normal
 * progress — giving each its own hue (blue for sourcing, violet for PO issued)
 * made the board look like five unrelated categories rather than one pipeline
 * read left to right.
 */
const COLUMNS: {
  key: RequisitionKanbanColumn;
  label: string;
  dot: string;
}[] = [
  { key: 'DRAFT', label: 'Draft', dot: 'bg-faint-line' },
  { key: 'AWAITING_APPROVAL', label: 'Awaiting approval', dot: 'bg-warn-solid' },
  { key: 'SOURCING', label: 'Sourcing', dot: 'bg-faint-line' },
  { key: 'PO_ISSUED', label: 'PO issued', dot: 'bg-faint-line' },
  { key: 'RECEIVED', label: 'Received', dot: 'bg-success-solid' },
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
  const [tab, setTab] = useState<RequisitionTab>('active');

  return (
    <div>
      <PageHeader
        title="Requisitions"
        description="Requests raised across the organisation, from draft to receipt."
        actions={
          <Link href="/requisitions/new">
            <Button variant="primary" size="sm">
              New requisition
            </Button>
          </Link>
        }
      />

      <SubNav
        className="mb-4"
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
        value={tab}
        onChange={(k) => setTab(k as RequisitionTab)}
      />

      {tab === 'active' ? <Board /> : <ListView tab={tab} />}
    </div>
  );
}

function Board(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useRequisitionBoard();
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

  if (isLoading || error) {
    return (
      <div>
        <DataState
          isLoading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          loading={
            <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-3 xl:grid-cols-5">
              {COLUMNS.map((col) => (
                <div key={col.key} className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-[104px] w-full rounded-lg" />
                  <Skeleton className="h-[104px] w-full rounded-lg" />
                </div>
              ))}
            </div>
          }
        >
          {null}
        </DataState>
      </div>
    );
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
              <span className="text-text text-caption font-semibold ">
                {col.label}
              </span>
              <span className="font-numeric text-faint ml-auto text-caption">{count}</span>
            </div>
            <div className="bg-canvas/40 flex min-h-[120px] flex-col gap-2 rounded-lg p-1.5"
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
                <div className="text-faint px-2 py-6 text-center text-caption">
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
      className="border-line bg-panel hover:border-accent/40 duration-hover block cursor-grab rounded-lg border p-3 transition-colors active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-numeric text-ink text-caption font-medium">
          {card.number}
        </span>
        {/* At most one badge per card. Priority outranks MSME here: an urgent
            request needs a decision today, whereas MSME is a standing fact
            about the vendor that the requisition detail also carries. */}
        {card.priority !== 'STANDARD' ? (
          <Badge variant={priorityVariant(card.priority)}>
            {priorityLabel(card.priority)}
          </Badge>
        ) : card.hasMsmeVendor ? (
          <Badge variant="classification">MSME</Badge>
        ) : null}
      </div>
      <div className="text-text mt-1 line-clamp-2 text-body-sm font-medium">
        {card.title}
      </div>
      <div className="text-muted mt-1 truncate text-micro">{card.costCenter.name}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-numeric text-ink text-body-sm font-semibold">
          {inr(card.totalAmount)}
        </span>
        <span className="font-numeric text-faint text-micro">
          {card.agingDays}d open
        </span>
      </div>
    </Link>
  );
}

const TAB_EMPTY: Record<RequisitionTab, { title: string; detail: string }> = {
  active: {
    title: 'No active requisitions',
    detail: 'Requests in progress will appear here once someone raises one.',
  },
  my_approval: {
    title: 'Nothing waiting on you',
    detail: 'Requisitions routed to you for approval will land here.',
  },
  draft: {
    title: 'No drafts',
    detail: 'Requisitions you start but have not submitted are kept here.',
  },
  rejected: {
    title: 'No rejected requisitions',
    detail: 'Requests an approver sent back will be listed here.',
  },
  closed: {
    title: 'Nothing closed yet',
    detail: 'Completed and cancelled requisitions are archived here.',
  },
};

function ListView({ tab }: { tab: RequisitionTab }): React.JSX.Element {
  const { data, isLoading, error, refetch } = useRequisitionList(tab);
  const rows = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <tr>
            <TableHead>Requisition</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="hidden md:table-cell">Cost centre</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Priority</TableHead>
            <TableHead numeric className="hidden sm:table-cell">
              Aging
            </TableHead>
            <TableHead numeric>Amount</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          <TableState
            colSpan={7}
            isLoading={isLoading}
            error={error}
            isEmpty={rows.length === 0}
            onRetry={() => void refetch()}
            empty={{
              title: TAB_EMPTY[tab].title,
              detail: TAB_EMPTY[tab].detail,
              action:
                tab === 'draft' || tab === 'active' ? (
                  <Link href="/requisitions/new">
                    <Button variant="primary" size="sm">
                      New requisition
                    </Button>
                  </Link>
                ) : undefined,
            }}
          />
          {rows.map((pr) => (
            <TableRow key={pr.id}>
              <TableCell>
                <Link
                  href={`/requisitions/${pr.id}`}
                  className="font-numeric text-ink font-medium hover:underline"
                >
                  {pr.number}
                </Link>
              </TableCell>
              <TableCell className="text-text">{pr.title}</TableCell>
              <TableCell className="text-muted hidden text-caption md:table-cell">
                {pr.costCenter.name}
              </TableCell>
              <TableCell>
                <Pill variant={statusVariant(pr.status)} dot>
                  {statusLabel(pr.status)}
                </Pill>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {pr.priority === 'STANDARD' ? (
                  <span className="text-muted text-caption">Standard</span>
                ) : (
                  <Badge variant={priorityVariant(pr.priority)}>
                    {priorityLabel(pr.priority)}
                  </Badge>
                )}
              </TableCell>
              <TableCell numeric className="text-text hidden sm:table-cell">
                {pr.agingDays}d
              </TableCell>
              <TableCell numeric className="text-ink font-medium">
                {inr(pr.totalAmount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
