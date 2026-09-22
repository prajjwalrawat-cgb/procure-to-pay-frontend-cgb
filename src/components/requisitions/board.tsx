'use client';

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  FilterBar,
  InfoTip,
  Input,
  Skeleton,
  SubNav,
  cn,
  matchesFilters,
  optionsFrom,
  useFilters,
  type FilterDef,
} from '@/components/ui';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PERMISSIONS,
  type RequisitionCardView,
  type RequisitionKanbanColumn,
} from '@/lib/shared';

import { useRequesterName } from '@/components/requisitions/requester';
import { useRequisitionBoard, useSubmitRequisition } from '@/lib/api/requisitions';
import { formatDate, inr, inrCompact } from '@/lib/format';
import { useHasPermission } from '@/lib/permissions';
import { PRIORITIES, priorityLabel, priorityVariant } from '@/lib/refs';
import { useSessionStore } from '@/store/session-store';
import { useToastStore } from '@/store/toast-store';

type Col = RequisitionKanbanColumn;
type Density = 'compact' | 'comfortable';

/**
 * The board columns.
 *
 * Only two dots carry colour: "Awaiting approval", because a request stalled
 * on a person is the one column that needs someone to act, and "Received",
 * because it is the finish line. The three in between are stages of normal
 * progress — giving each its own hue made the board look like five unrelated
 * categories rather than one pipeline read left to right.
 */
const COLUMNS: { key: Col; label: string; dot: string }[] = [
  { key: 'DRAFT', label: 'Draft', dot: 'bg-faint-line' },
  { key: 'AWAITING_APPROVAL', label: 'Awaiting approval', dot: 'bg-warn-solid' },
  { key: 'SOURCING', label: 'Sourcing', dot: 'bg-faint-line' },
  { key: 'PO_ISSUED', label: 'PO issued', dot: 'bg-faint-line' },
  { key: 'RECEIVED', label: 'Received', dot: 'bg-success-solid' },
];
const STAGE_INDEX = new Map(COLUMNS.map((c, i) => [c.key, i]));

const ORDER_KEY = 'pf_pr_board_order';
const DENSITY_KEY = 'pf_pr_board_density';

/**
 * Days a request may sit in "Awaiting approval" before the column flags it.
 * The card carries only age since it was raised (agingDays is from createdAt,
 * not from submission), so the rule is worded that way wherever it is shown.
 */
const STALL_DAYS = 7;

type BoardOrder = Partial<Record<Col, string[]>>;

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable (private window, blocked site data) */
  }
}

/** Local calendar date as yyyy-mm-dd — "past needed-by" is a calendar question. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isOverdue(card: RequisitionCardView, today: string): boolean {
  return card.column !== 'RECEIVED' && !!card.neededBy && card.neededBy.slice(0, 10) < today;
}

function isStalled(card: RequisitionCardView): boolean {
  return card.column === 'AWAITING_APPROVAL' && card.agingDays >= STALL_DAYS;
}

type DropRule = { ok: true; kind: 'reorder' | 'submit' } | { ok: false; reason: string };

/**
 * What a drop from one stage onto another means. The columns are derived from
 * the requisition's status and its POs — there is no move-stage endpoint — so
 * the only cross-column drop with a real transition behind it is
 * Draft → Awaiting approval (POST /requisitions/:id/submit). Every other drop
 * explains what actually moves the card.
 */
function dropRule(from: Col, to: Col, canSubmit: boolean): DropRule {
  if (from === to) return { ok: true, kind: 'reorder' };
  if (from === 'DRAFT' && to === 'AWAITING_APPROVAL') {
    return canSubmit
      ? { ok: true, kind: 'submit' }
      : { ok: false, reason: "Your role can't submit requisitions for approval." };
  }
  const backwards = (STAGE_INDEX.get(to) ?? 0) < (STAGE_INDEX.get(from) ?? 0);
  if (to === 'DRAFT') {
    return {
      ok: false,
      reason:
        "A requisition can't go back to draft. An approver can send it back with Request changes.",
    };
  }
  if (backwards) {
    return {
      ok: false,
      reason: "Stages follow the requisition's real status, so it can't move back a stage.",
    };
  }
  if (to === 'AWAITING_APPROVAL') {
    return { ok: false, reason: 'Only drafts can be submitted for approval.' };
  }
  if (to === 'SOURCING') {
    return {
      ok: false,
      reason:
        from === 'DRAFT'
          ? 'Submit it for approval first — it moves to Sourcing once approved.'
          : 'It moves to Sourcing when approved. Decide it in your Approvals inbox.',
    };
  }
  if (to === 'PO_ISSUED') {
    return {
      ok: false,
      reason:
        from === 'SOURCING'
          ? 'Open the requisition and use Create PO — it moves here once a PO is raised.'
          : 'It needs approval and a purchase order before it can move here.',
    };
  }
  return {
    ok: false,
    reason:
      from === 'PO_ISSUED'
        ? 'It moves here when goods are received against its PO — record a GRN.'
        : 'It moves here only after a PO is issued and the goods are received.',
  };
}

function filterValue(
  c: RequisitionCardView,
  key: string,
  me: string | undefined,
  today: string,
): string | number | null {
  switch (key) {
    case 'costCenter':
      return c.costCenter.id;
    case 'priority':
      return c.priority;
    case 'requester':
      return c.requester.id === me ? 'me' : c.requester.id;
    case 'amount':
      return Number(c.totalAmount);
    case 'neededBy':
      return c.neededBy;
    case 'flag':
      return isOverdue(c, today) ? 'overdue' : isStalled(c) ? 'stalled' : 'none';
    default:
      return null;
  }
}

export function RequisitionBoard(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useRequisitionBoard();
  const toast = useToastStore((s) => s.push);
  const canSubmit = useHasPermission(PERMISSIONS.REQUISITION_SUBMIT);
  const requesterName = useRequesterName();
  const me = useSessionStore((s) => s.user?.id);
  const today = useMemo(todayIso, []);

  const [order, setOrder] = useState<BoardOrder>({});
  const [density, setDensity] = useState<Density>('comfortable');
  const [drag, setDrag] = useState<{ id: string; from: Col } | null>(null);
  const [over, setOver] = useState<{ col: Col; cardId: string | null } | null>(null);
  // Set when a drop lands. An invalid target sets dropEffect 'none', so the
  // browser never fires `drop` there — dragend has to do the explaining.
  const dropped = useRef(false);
  const [pendingSubmit, setPendingSubmit] = useState<RequisitionCardView | null>(null);
  const [stage, setStage] = useState<Col>('DRAFT');
  const [search, setSearch] = useState('');
  const filters = useFilters();

  useEffect(() => {
    const saved = readStorage<BoardOrder>(ORDER_KEY);
    if (saved) setOrder(saved);
    const d = readStorage<Density>(DENSITY_KEY);
    if (d === 'compact' || d === 'comfortable') setDensity(d);
  }, []);

  const chooseDensity = (d: Density): void => {
    setDensity(d);
    writeStorage(DENSITY_KEY, d);
  };

  const all = useMemo(
    () => (data ? COLUMNS.flatMap((c) => data.columns[c.key] ?? []) : []),
    [data],
  );

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'costCenter',
        label: 'Cost centre',
        type: 'select',
        options: optionsFrom(all, (c) => ({
          value: c.costCenter.id,
          label: `${c.costCenter.code}, ${c.costCenter.name}`,
        })),
      },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITIES },
      {
        key: 'requester',
        label: 'Requester',
        type: 'select',
        // Only requesters we can name honestly — see useRequesterName.
        options: [
          { value: 'me', label: 'Raised by me' },
          ...optionsFrom(all, (c) => {
            if (c.requester.id === me) return null;
            const name = requesterName(c.requester);
            return name ? { value: c.requester.id, label: name } : null;
          }),
        ],
      },
      { key: 'amount', label: 'Amount', type: 'amount' },
      { key: 'neededBy', label: 'Needed by', type: 'date' },
      {
        key: 'flag',
        label: 'Attention',
        type: 'select',
        options: [
          { value: 'overdue', label: 'Overdue' },
          { value: 'stalled', label: `Awaiting approval, raised ${STALL_DAYS}+ days ago` },
        ],
      },
    ],
    [all, me, requesterName],
  );

  const narrowed = search.trim() !== '' || filters.activeCount > 0;
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (c: RequisitionCardView): boolean =>
      (!q ||
        c.number.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.costCenter.name.toLowerCase().includes(q) ||
        c.costCenter.code.toLowerCase().includes(q)) &&
      matchesFilters(c, defs, filters.values, (row, key) => filterValue(row, key, me, today));
  }, [search, defs, filters.values, me, today]);

  const ordered = (col: Col): RequisitionCardView[] => {
    const cards = data?.columns[col] ?? [];
    const saved = order[col];
    if (!saved) return cards;
    const rank = new Map(saved.map((id, i) => [id, i]));
    return [...cards].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  };

  /** Moves `id` next to `anchorId` (or to the end) in the column's saved order. */
  const reorder = (col: Col, id: string, anchorId: string | null, side: 'before' | 'after'): void => {
    const ids = ordered(col)
      .map((c) => c.id)
      .filter((x) => x !== id);
    let at = anchorId ? ids.indexOf(anchorId) : -1;
    if (at === -1) at = ids.length;
    else if (side === 'after') at += 1;
    ids.splice(at, 0, id);
    const next = { ...order, [col]: ids };
    setOrder(next);
    writeStorage(ORDER_KEY, next);
  };

  const attemptMove = (card: RequisitionCardView, to: Col, anchorId: string | null): void => {
    const rule = dropRule(card.column, to, canSubmit);
    if (!rule.ok) {
      toast(rule.reason, 'info');
      return;
    }
    if (rule.kind === 'submit') setPendingSubmit(card);
    else if (anchorId !== card.id) reorder(to, card.id, anchorId, 'before');
  };

  const endDrag = (): void => {
    setDrag(null);
    setOver(null);
  };

  const onDragEnd = (card: RequisitionCardView): void => {
    if (!dropped.current && over && over.col !== card.column) {
      const rule = dropRule(card.column, over.col, canSubmit);
      if (!rule.ok) toast(rule.reason, 'info');
    }
    endDrag();
  };

  const onKeyMove = (card: RequisitionCardView, e: React.KeyboardEvent): void => {
    if (!e.altKey) return;
    const visible = ordered(card.column).filter(matches);
    const i = visible.findIndex((c) => c.id === card.id);
    if (e.key === 'ArrowUp' && i > 0) {
      e.preventDefault();
      reorder(card.column, card.id, visible[i - 1].id, 'before');
    } else if (e.key === 'ArrowDown' && i >= 0 && i < visible.length - 1) {
      e.preventDefault();
      reorder(card.column, card.id, visible[i + 1].id, 'after');
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const idx = (STAGE_INDEX.get(card.column) ?? 0) + (e.key === 'ArrowRight' ? 1 : -1);
      const to = COLUMNS[idx]?.key;
      if (to) attemptMove(card, to, null);
    }
  };

  if (isLoading) {
    return (
      <div aria-busy="true" className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {COLUMNS.map((col, i) => (
          <div key={col.key} className={cn('flex-col gap-2', i === 0 ? 'flex' : 'hidden md:flex')}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-[104px] w-full rounded-lg" />
            <Skeleton className="h-[104px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const columns = COLUMNS.map((col) => {
    const full = ordered(col.key);
    const cards = full.filter(matches);
    return {
      ...col,
      cards,
      loaded: full.length,
      // The board returns at most 200 cards; counts are the true totals.
      total: data?.counts[col.key] ?? full.length,
      value: cards.reduce((s, c) => s + Number(c.totalAmount), 0),
      overdue: cards.filter((c) => isOverdue(c, today)).length,
      stalled: cards.filter(isStalled).length,
    };
  });
  const shown = columns.reduce((s, c) => s + c.cards.length, 0);
  const truncated = columns.some((c) => c.total > c.loaded);

  return (
    <div>
      <FilterBar
        defs={defs}
        filters={filters}
        search={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search number, title or cost centre…"
            aria-label="Search requisitions"
          />
        }
        summary={`${narrowed ? `${shown} of ${all.length}` : all.length} shown${truncated ? ' — most recent 200 loaded' : ''}`}
        actions={<DensityToggle value={density} onChange={chooseDensity} />}
      />

      <p className="text-faint -mt-2 mb-3 text-caption">
        Overdue = past its needed-by date and not yet received.
        <span className="hidden md:inline">
          {' '}
          Drag a draft onto Awaiting approval to submit it; Alt + arrow keys do the same from the
          keyboard.
        </span>
      </p>

      {all.length === 0 ? (
        <EmptyState
          title="No active requisitions"
          detail="Requests in progress appear here once someone raises one."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/requisitions/new">New requisition</Link>
            </Button>
          }
        />
      ) : shown === 0 ? (
        <EmptyState
          title="No requisitions match these filters"
          detail="Clear a filter or change the search to see more."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                filters.clear();
                setSearch('');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          {/* Phones get one stage at a time: five columns side by side at 375px
              is either unreadable or a sideways scroll. */}
          <SubNav
            aria-label="Stage"
            className="mb-3 md:hidden"
            items={columns.map((c) => ({ key: c.key, label: c.label, count: c.cards.length }))}
            value={stage}
            onChange={(k) => setStage(k as Col)}
          />
          <p id="pr-board-kbd" className="sr-only">
            Alt plus Up or Down reorders the card within its stage. Alt plus Right on a draft
            submits it for approval.
          </p>
          <div className="flex gap-3 md:snap-x md:snap-mandatory md:overflow-x-auto md:pb-2 xl:grid xl:grid-cols-5 xl:overflow-visible xl:pb-0">
            {columns.map((col) => {
              const rule = drag ? dropRule(drag.from, col.key, canSubmit) : null;
              const isTarget = !!rule?.ok;
              const isHover = over?.col === col.key;
              return (
                <section
                  key={col.key}
                  aria-label={col.label}
                  className={cn(
                    'min-w-0 flex-col md:flex md:w-[272px] md:shrink-0 md:snap-start xl:w-auto',
                    stage === col.key ? 'flex w-full' : 'hidden',
                  )}
                >
                  <ColumnHeader col={col} drag={drag} rule={rule} />
                  <div
                    onDragOver={(e) => {
                      if (!drag) return;
                      // Always accept so an invalid drop can explain itself;
                      // the cursor still says whether the drop will do anything.
                      e.preventDefault();
                      e.dataTransfer.dropEffect = isTarget ? 'move' : 'none';
                      // Functional: a card's own dragover (which names the anchor card)
                      // has already queued its update in this same event.
                      setOver((prev) =>
                        prev?.col === col.key ? prev : { col: col.key, cardId: null },
                      );
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      dropped.current = true;
                      const card = drag && all.find((c) => c.id === drag.id);
                      const anchor = over?.col === col.key ? over.cardId : null;
                      endDrag();
                      if (card) attemptMove(card, col.key, anchor);
                    }}
                    className={cn(
                      'duration-hover flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg border p-1.5 transition-colors',
                      !drag && 'bg-canvas/40 border-transparent',
                      drag && isTarget && !isHover && 'border-accent/40 bg-accent-wash/40 border-dashed',
                      drag && isTarget && isHover && 'border-accent bg-accent-wash',
                      drag && !isTarget && 'bg-canvas/40 border-transparent opacity-50',
                    )}
                  >
                    {col.cards.map((card) => (
                      <BoardCard
                        key={card.id}
                        card={card}
                        density={density}
                        today={today}
                        requester={requesterName(card.requester)}
                        dragging={drag?.id === card.id}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', card.id);
                          dropped.current = false;
                          setDrag({ id: card.id, from: card.column });
                        }}
                        onDragEnd={() => onDragEnd(card)}
                        onDragOverCard={() => {
                          if (drag && (over?.col !== col.key || over.cardId !== card.id)) {
                            setOver({ col: col.key, cardId: card.id });
                          }
                        }}
                        onKeyDown={(e) => onKeyMove(card, e)}
                      />
                    ))}
                    {col.cards.length === 0 && (
                      <div className="text-faint px-2 py-6 text-center text-caption">
                        {narrowed && col.loaded > 0 ? 'None match the filters' : 'Nothing here'}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      {pendingSubmit && (
        <SubmitConfirm card={pendingSubmit} onClose={() => setPendingSubmit(null)} />
      )}
    </div>
  );
}

function ColumnHeader({
  col,
  drag,
  rule,
}: {
  col: {
    key: Col;
    label: string;
    dot: string;
    cards: RequisitionCardView[];
    loaded: number;
    total: number;
    value: number;
    overdue: number;
    stalled: number;
  };
  drag: { id: string; from: Col } | null;
  rule: DropRule | null;
}): React.JSX.Element {
  const filtered = col.cards.length !== col.loaded;
  return (
    <div className="mb-2 px-1">
      <div className="flex items-center gap-2">
        <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', col.dot)} />
        <h2 className="text-text truncate text-caption font-semibold">{col.label}</h2>
        <span className="font-numeric text-faint ml-auto text-caption">
          {filtered ? `${col.cards.length} / ${col.total}` : col.total}
        </span>
      </div>
      <div className="mt-0.5 flex min-h-[18px] items-center justify-between gap-2 text-micro">
        {drag && rule && drag.from !== col.key ? (
          rule.ok ? (
            <span className="text-accent font-medium">Drop to submit for approval</span>
          ) : (
            <span className="text-faint">Can&apos;t move here</span>
          )
        ) : (
          <>
            <span className="font-numeric text-muted" title={inr(col.value)}>
              {inrCompact(col.value)}
            </span>
            <span className="flex items-center gap-2">
              {col.stalled > 0 && (
                <InfoTip
                  content={`Raised ${STALL_DAYS} or more days ago and still waiting for approval. Chase them from the Approvals inbox.`}
                >
                  <span tabIndex={0} className="text-warn font-medium">
                    {col.stalled} raised {STALL_DAYS}d+
                  </span>
                </InfoTip>
              )}
              {col.overdue > 0 && (
                <InfoTip content="Past the needed-by date and not yet received.">
                  <span tabIndex={0} className="text-danger font-medium">
                    {col.overdue} overdue
                  </span>
                </InfoTip>
              )}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function BoardCard({
  card,
  density,
  today,
  requester,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onKeyDown,
}: {
  card: RequisitionCardView;
  density: Density;
  today: string;
  requester: string | null;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOverCard: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}): React.JSX.Element {
  const overdue = isOverdue(card, today);
  const stalled = isStalled(card);
  const compact = density === 'compact';
  return (
    <Link
      href={`/requisitions/${card.id}`}
      draggable
      aria-describedby="pr-board-kbd"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverCard}
      onKeyDown={onKeyDown}
      className={cn(
        'border-line bg-panel hover:border-accent/40 duration-hover block cursor-grab rounded-lg border transition-colors active:cursor-grabbing',
        compact ? 'px-2.5 py-2' : 'p-3',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-numeric text-ink text-caption font-medium">{card.number}</span>
        {/* At most one badge per card. Priority outranks MSME here: an urgent
            request needs a decision today, whereas MSME is a standing fact
            about the vendor that the requisition detail also carries. */}
        {card.priority !== 'STANDARD' ? (
          <Badge variant={priorityVariant(card.priority)}>{priorityLabel(card.priority)}</Badge>
        ) : card.hasMsmeVendor ? (
          <Badge variant="classification">MSME</Badge>
        ) : null}
      </div>
      <div
        className={cn(
          'text-text mt-1 text-body-sm font-medium',
          compact ? 'truncate' : 'line-clamp-2',
        )}
      >
        {card.title}
      </div>

      {!compact && (
        <div className="text-muted mt-1 flex flex-col gap-0.5 text-caption">
          <span className="truncate">
            {card.costCenter.name} · {card.lineCount} line{card.lineCount === 1 ? '' : 's'}
          </span>
          {requester && <span className="truncate">Raised by {requester}</span>}
          {card.neededBy && (
            <span className={cn('font-numeric', overdue && 'text-danger')}>
              Needed {formatDate(card.neededBy)}
              {overdue ? ' · overdue' : ''}
            </span>
          )}
        </div>
      )}

      <div className={cn('flex items-center justify-between gap-2', compact ? 'mt-1' : 'mt-2')}>
        <span className="font-numeric text-ink text-body-sm font-semibold">
          {inr(card.totalAmount)}
        </span>
        {compact ? (
          overdue ? (
            <span className="text-danger text-micro font-medium">Overdue</span>
          ) : stalled ? (
            <span className="font-numeric text-warn text-micro">{card.agingDays}d</span>
          ) : null
        ) : (
          <span className={cn('font-numeric text-micro', stalled ? 'text-warn' : 'text-faint')}>
            {card.agingDays}d since raised
          </span>
        )}
      </div>
    </Link>
  );
}

function DensityToggle({
  value,
  onChange,
}: {
  value: Density;
  onChange: (d: Density) => void;
}): React.JSX.Element {
  return (
    <div role="group" aria-label="Card density" className="border-line inline-flex rounded-sm border p-0.5">
      {(['compact', 'comfortable'] as const).map((d) => (
        <button
          key={d}
          type="button"
          data-density={d}
          aria-pressed={value === d}
          onClick={() => onChange(d)}
          className={cn(
            'duration-hover h-7 rounded-xs px-2.5 text-caption font-medium capitalize transition-colors',
            value === d ? 'bg-canvas text-text' : 'text-muted hover:text-text',
          )}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

/**
 * Confirms a Draft → Awaiting approval drop, then calls the real submit
 * endpoint. Mounted per card so it can use the id-bound submit hook, which
 * also invalidates the board so the card lands in its new column.
 */
function SubmitConfirm({
  card,
  onClose,
}: {
  card: RequisitionCardView;
  onClose: () => void;
}): React.JSX.Element {
  const submit = useSubmitRequisition(card.id);
  const toast = useToastStore((s) => s.push);
  return (
    <Dialog open onOpenChange={(o) => !o && !submit.isPending && onClose()}>
      <DialogContent>
        <DialogTitle>Submit {card.number} for approval?</DialogTitle>
        <DialogDescription className="mt-1">
          It goes to the approvers on your approval matrix and can no longer be edited unless an
          approver sends it back.
        </DialogDescription>
        <dl className="border-line mt-4 flex flex-col gap-1.5 rounded-sm border p-3 text-body-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Title</dt>
            <dd className="text-text truncate text-right">{card.title}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Cost centre</dt>
            <dd className="text-text text-right">{card.costCenter.name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Amount</dt>
            <dd className="font-numeric text-ink text-right font-medium">
              {inr(card.totalAmount)}
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submit.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={submit.isPending}
            onClick={() =>
              submit.mutate(undefined, {
                onSuccess: () => {
                  toast(`${card.number} submitted for approval`, 'success');
                  onClose();
                },
                onError: (e) => {
                  toast((e as Error).message, 'error');
                  onClose();
                },
              })
            }
          >
            {submit.isPending ? 'Submitting…' : 'Submit for approval'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
