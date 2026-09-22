'use client';

import type { InboxItem } from '@/lib/shared';
import { PERMISSIONS } from '@/lib/shared';
import {
  BulkActionBar,
  Button,
  Checkbox,
  FilterBar,
  Input,
  PageHeader,
  Pill,
  SortableHead,
  SubNav,
  TableState,
  matchesFilters,
  optionsFrom,
  useFilters,
  useSelection,
  useSort,
  type FilterDef,
} from '@/components/ui';
import { CheckCircle2, Download } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  BulkApproveDialog,
  BulkRejectDialog,
  describeApprove,
  describeReject,
} from '@/components/approvals/inbox-bulk';
import { displayNumber } from '@/components/approvals/display-number';
import { useInbox, type InboxFilterKey } from '@/lib/api/inbox';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, inr } from '@/lib/format';
import { useHasPermission } from '@/lib/permissions';
import { useToastStore } from '@/store/toast-store';

const FILTERS: { key: InboxFilterKey; label: string }[] = [
  { key: 'waiting_on_me', label: 'Waiting on me' },
  { key: 'all', label: 'All' },
  { key: 'delegated_to_me', label: 'Delegated to me' },
  { key: 'delegated_by_me', label: 'Delegated by me' },
];

const SLA_VARIANT = { ok: 'success', warn: 'warn', breach: 'danger' } as const;

/**
 * The SLA state, in words a reviewer can act on — "Overdue" rather than the
 * raw "breach" key the API sends.
 */
const SLA_LABEL = {
  ok: 'On time',
  warn: 'Due soon',
  breach: 'Overdue',
} as const;

/** `VENDOR_ONBOARDING` → `Vendor onboarding` */
function documentTypeLabel(t: string): string {
  const s = t.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type SortKey = 'type' | 'submitter' | 'amount' | 'pending' | 'sla';
const SLA_RANK = { breach: 0, warn: 1, ok: 2 } as const;
const SORT: Record<SortKey, (i: InboxItem) => string | number | null> = {
  type: (i) => documentTypeLabel(i.documentType),
  submitter: (i) => i.submitterName,
  amount: (i) => (i.amount === null ? null : Number(i.amount)),
  pending: (i) => i.daysPending,
  // Due time where there is one; otherwise fall back to the status rank so
  // overdue rows still sort ahead of on-time ones.
  sla: (i) => (i.slaDueAt ? new Date(i.slaDueAt).getTime() : SLA_RANK[i.slaStatus]),
};

function filterValue(i: InboxItem, key: string): string | number | null {
  switch (key) {
    case 'type':
      return i.documentType;
    case 'submitter':
      return i.submitterName ?? 'none';
    case 'sla':
      return i.slaStatus;
    case 'amount':
      return i.amount === null ? null : Number(i.amount);
    case 'pending':
      return i.daysPending;
    default:
      return null;
  }
}

export default function InboxPage(): React.JSX.Element {
  const [filter, setFilter] = useState<InboxFilterKey>('waiting_on_me');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const filters = useFilters();
  const { data, isLoading, error, refetch } = useInbox(filter);
  // Every decide call requires the caller to be the approval's current
  // approver. The "All" and "Delegated by me" views also list approvals now
  // sitting with someone else, and an item does not say whose it is — so the
  // waiting-on-me list is the authority on what this user can decide.
  const waiting = useInbox('waiting_on_me');
  const canDecidePerm = useHasPermission(PERMISSIONS.APPROVAL_DECIDE);
  const toast = useToastStore((s) => s.push);

  const items = useMemo(() => data?.items ?? [], [data]);
  const decidable = useMemo(
    () => new Set((waiting.data?.items ?? []).map((i) => i.approvalId)),
    [waiting.data],
  );

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'type',
        label: 'Document type',
        type: 'select',
        options: optionsFrom(items, (i) => ({
          value: i.documentType,
          label: documentTypeLabel(i.documentType),
        })),
      },
      {
        key: 'submitter',
        label: 'Submitter',
        type: 'select',
        options: [
          { value: 'none', label: 'Not recorded' },
          ...optionsFrom(items, (i) =>
            i.submitterName ? { value: i.submitterName, label: i.submitterName } : null,
          ),
        ],
      },
      {
        key: 'sla',
        label: 'SLA status',
        type: 'select',
        options: [
          { value: 'breach', label: SLA_LABEL.breach },
          { value: 'warn', label: SLA_LABEL.warn },
          { value: 'ok', label: SLA_LABEL.ok },
        ],
      },
      { key: 'amount', label: 'Amount', type: 'amount' },
      { key: 'pending', label: 'Days pending', type: 'number', unit: 'd' },
    ],
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!q ||
          i.number.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          (i.submitterName ?? '').toLowerCase().includes(q) ||
          documentTypeLabel(i.documentType).toLowerCase().includes(q)) &&
        matchesFilters(i, defs, filters.values, filterValue),
    );
  }, [items, search, defs, filters.values]);

  const { sorted: rows, sort, toggle: toggleSort } = useSort(filtered, SORT);
  const selection = useSelection(rows.map((r) => r.approvalId));
  const selectedRows = rows.filter((r) => selection.isSelected(r.approvalId));
  const decideIds = canDecidePerm
    ? selectedRows.filter((r) => decidable.has(r.approvalId)).map((r) => r.approvalId)
    : [];
  const notMine = selectedRows.length - decideIds.length;
  const narrowed = search.trim() !== '' || filters.activeCount > 0;
  const overdue = rows.filter((r) => r.slaStatus === 'breach').length;

  const exportSelected = (): void =>
    downloadCsv(`approvals-${filter}`, selectedRows, [
      { header: 'Document type', value: (i) => documentTypeLabel(i.documentType) },
      { header: 'Number', value: (i) => i.number },
      { header: 'Title', value: (i) => i.title },
      { header: 'Submitter', value: (i) => i.submitterName },
      { header: 'Amount', value: (i) => i.amount },
      { header: 'Currency', value: (i) => i.currency },
      { header: 'Days pending', value: (i) => i.daysPending },
      { header: 'SLA', value: (i) => SLA_LABEL[i.slaStatus] },
      { header: 'SLA due', value: (i) => i.slaDueAt },
      { header: 'Delegated from', value: (i) => i.delegatedFromName },
    ]);

  const counts = data?.counts ?? waiting.data?.counts;

  return (
    <div className="pb-20">
      <PageHeader
        title="Approvals inbox"
        description="Documents routed to you for a decision, and approvals you have delegated."
      />

      <SubNav
        className="mb-4"
        items={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          count: f.key === 'all' ? undefined : counts?.[f.key],
        }))}
        value={filter}
        onChange={(k) => setFilter(k as InboxFilterKey)}
      />

      <FilterBar
        defs={defs}
        filters={filters}
        search={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search document, title or submitter…"
            aria-label="Search approvals"
          />
        }
        summary={
          isLoading ? null : (
            <>
              {rows.length} shown
              {overdue > 0 && <span className="text-danger"> · {overdue} overdue</span>}
            </>
          )
        }
      />

      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line border-b text-left text-muted">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  aria-label="Select all shown approvals"
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected}
                  onChange={selection.toggleAll}
                  disabled={rows.length === 0}
                />
              </th>
              <SortableHead label="Document" sortKey="type" sort={sort} onSort={toggleSort} />
              <SortableHead
                label="Submitter"
                sortKey="submitter"
                sort={sort}
                onSort={toggleSort}
              />
              <SortableHead
                label="Amount"
                sortKey="amount"
                sort={sort}
                onSort={toggleSort}
                numeric
              />
              <SortableHead
                label="Pending"
                sortKey="pending"
                sort={sort}
                onSort={toggleSort}
                numeric
              />
              <SortableHead label="SLA" sortKey="sla" sort={sort} onSort={toggleSort} />
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={7}
              isLoading={isLoading}
              error={error}
              isEmpty={rows.length === 0}
              onRetry={() => void refetch()}
              empty={
                narrowed
                  ? {
                      title: 'No approvals match these filters',
                      detail: 'Clear a filter or change the search to see more.',
                      action: (
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
                      ),
                    }
                  : filter === 'waiting_on_me'
                    ? {
                        title: 'Nothing waiting on you',
                        detail:
                          'Your approval queue is clear. Documents routed to you will appear here.',
                        icon: CheckCircle2,
                      }
                    : {
                        title: 'Nothing in this view',
                        detail:
                          filter === 'all'
                            ? 'No approvals are pending with you or with anyone you delegated to.'
                            : 'Delegated approvals will be listed here.',
                      }
              }
            />
            {rows.map((item) => {
              const isSel = selection.isSelected(item.approvalId);
              const mine = decidable.has(item.approvalId);
              return (
                <tr
                  key={item.approvalId}
                  className={
                    'border-line border-b transition-colors duration-hover ' +
                    (isSel ? 'bg-accent-wash/60' : 'hover:bg-canvas/60')
                  }
                >
                  <td className="px-3 py-3.5">
                    <Checkbox
                      aria-label={`Select ${item.number}`}
                      checked={isSel}
                      onChange={() => selection.toggle(item.approvalId)}
                    />
                  </td>
                  <td className="min-w-0 px-3 py-3.5">
                    {/* The type leads — a queue of mixed documents is read by
                        kind first. The identifier is often a raw id the server
                        has no friendlier name for, so it sits underneath at
                        meta size rather than standing in as the title. */}
                    <Link href={item.href} className="text-ink hover:text-accent font-medium">
                      {documentTypeLabel(item.documentType)}
                    </Link>
                    {item.title !== item.number && (
                      <div className="text-text truncate">{item.title}</div>
                    )}
                    <div className="font-numeric text-faint truncate text-micro">
                      {[
                        displayNumber(item),
                        item.delegatedFromName ? `via ${item.delegatedFromName}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      {!mine && filter !== 'waiting_on_me' && !waiting.isLoading
                        ? `${displayNumber(item) || item.delegatedFromName ? ' · ' : ''}with another approver`
                        : ''}
                    </div>
                  </td>
                  <td className="text-muted px-3 py-3.5">{item.submitterName ?? '—'}</td>
                  <td className="font-numeric text-ink px-3 py-3.5 text-right font-medium">
                    {item.amount ? inr(item.amount) : '—'}
                  </td>
                  <td className="font-numeric px-3 py-3.5 text-right">{item.daysPending}d</td>
                  <td className="px-3 py-3.5">
                    <Pill variant={SLA_VARIANT[item.slaStatus]} dot>
                      {SLA_LABEL[item.slaStatus]}
                    </Pill>
                    {item.slaDueAt && (
                      <div className="font-numeric text-faint text-micro">
                        Due {formatDateTime(item.slaDueAt)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <Link href={item.href} className="text-accent text-caption font-medium">
                      {mine ? 'Review' : 'Open'}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BulkActionBar
        count={selection.count}
        noun="approval"
        onClear={selection.clear}
        note={
          !canDecidePerm
            ? 'Your role cannot decide approvals.'
            : notMine > 0
              ? `${notMine} selected ${notMine === 1 ? 'is' : 'are'} with another approver and will be skipped.`
              : undefined
        }
      >
        {decideIds.length > 0 && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setDialog('approve')}>
              Approve {decideIds.length}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog('reject')}>
              Reject {decideIds.length}
            </Button>
          </>
        )}
        <Button size="sm" variant="secondary" onClick={exportSelected}>
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </Button>
      </BulkActionBar>

      <BulkApproveDialog
        ids={decideIds}
        open={dialog === 'approve'}
        onOpenChange={(o) => setDialog(o ? 'approve' : null)}
        onDone={(o) => {
          toast(describeApprove(o), o.error ? 'error' : 'success');
          if (!o.error) selection.clear();
        }}
      />
      <BulkRejectDialog
        ids={decideIds}
        open={dialog === 'reject'}
        onOpenChange={(o) => setDialog(o ? 'reject' : null)}
        onDone={(o) => {
          toast(describeReject(o), o.failed.length ? 'error' : 'success');
          if (o.failed.length === 0) selection.clear();
        }}
      />
    </div>
  );
}
