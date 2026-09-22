'use client';

import {
  Badge,
  BulkActionBar,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  FilterBar,
  Input,
  Pill,
  SortableHead,
  TableState,
  cn,
  matchesFilters,
  optionsFrom,
  useFilters,
  useSelection,
  useSort,
  type FilterDef,
} from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PERMISSIONS, type RequisitionCardView } from '@/lib/shared';

import { useRequesterName } from '@/components/requisitions/requester';
import { apiFetch } from '@/lib/api-client';
import {
  requisitionKeys,
  useRequisitionList,
  type RequisitionTab,
} from '@/lib/api/requisitions';
import { downloadCsv } from '@/lib/csv';
import { formatDate, inr, statusLabel, statusVariant } from '@/lib/format';
import { useHasPermission } from '@/lib/permissions';
import { PRIORITIES, priorityLabel, priorityVariant } from '@/lib/refs';
import { useSessionStore } from '@/store/session-store';
import { useToastStore } from '@/store/toast-store';

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

const PRIORITY_RANK: Record<string, number> = { LOW: 0, STANDARD: 1, HIGH: 2, CRITICAL: 3 };

type SortKey = 'number' | 'title' | 'status' | 'priority' | 'neededBy' | 'aging' | 'amount';
const SORT: Record<SortKey, (r: RequisitionCardView) => string | number | null> = {
  number: (r) => r.number,
  title: (r) => r.title,
  status: (r) => statusLabel(r.status),
  priority: (r) => PRIORITY_RANK[r.priority] ?? 1,
  neededBy: (r) => (r.neededBy ? new Date(r.neededBy).getTime() : null),
  aging: (r) => r.agingDays,
  amount: (r) => Number(r.totalAmount),
};

function filterValue(
  r: RequisitionCardView,
  key: string,
  me: string | undefined,
): string | number | null {
  switch (key) {
    case 'costCenter':
      return r.costCenter.id;
    case 'status':
      return r.status;
    case 'priority':
      return r.priority;
    case 'requester':
      return r.requester.id === me ? 'me' : r.requester.id;
    case 'amount':
      return Number(r.totalAmount);
    case 'neededBy':
      return r.neededBy;
    case 'aging':
      return r.agingDays;
    default:
      return null;
  }
}

/** The non-board tabs: a sortable, filterable, selectable table. */
export function RequisitionListView({ tab }: { tab: RequisitionTab }): React.JSX.Element {
  const { data, isLoading, error, refetch } = useRequisitionList(tab);
  const toast = useToastStore((s) => s.push);
  const me = useSessionStore((s) => s.user?.id);
  const myName = useSessionStore((s) => s.user?.name);
  const requesterName = useRequesterName();
  const canSubmit = useHasPermission(PERMISSIONS.REQUISITION_SUBMIT);
  const [search, setSearch] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const filters = useFilters();

  const items = useMemo(() => data?.items ?? [], [data]);

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'costCenter',
        label: 'Cost centre',
        type: 'select',
        options: optionsFrom(items, (r) => ({
          value: r.costCenter.id,
          label: `${r.costCenter.code}, ${r.costCenter.name}`,
        })),
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: optionsFrom(items, (r) => ({ value: r.status, label: statusLabel(r.status) })),
      },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITIES },
      {
        key: 'requester',
        label: 'Requester',
        type: 'select',
        options: [
          { value: 'me', label: 'Raised by me' },
          ...optionsFrom(items, (r) => {
            if (r.requester.id === me) return null;
            const name = requesterName(r.requester);
            return name ? { value: r.requester.id, label: name } : null;
          }),
        ],
      },
      { key: 'amount', label: 'Amount', type: 'amount' },
      { key: 'neededBy', label: 'Needed by', type: 'date' },
      { key: 'aging', label: 'Days since raised', type: 'number', unit: 'd' },
    ],
    [items, me, requesterName],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (r) =>
        (!q ||
          r.number.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.costCenter.name.toLowerCase().includes(q)) &&
        matchesFilters(r, defs, filters.values, (row, key) => filterValue(row, key, me)),
    );
  }, [items, search, defs, filters.values, me]);

  const { sorted: rows, sort, toggle: toggleSort } = useSort(filtered, SORT);
  const selection = useSelection(rows.map((r) => r.id));
  const selectedRows = rows.filter((r) => selection.isSelected(r.id));
  const selectedDrafts = selectedRows.filter((r) => r.status === 'DRAFT');
  const narrowed = search.trim() !== '' || filters.activeCount > 0;

  const exportSelected = (): void =>
    downloadCsv(`requisitions-${tab}`, selectedRows, [
      { header: 'Requisition', value: (r) => r.number },
      { header: 'Title', value: (r) => r.title },
      { header: 'Cost centre code', value: (r) => r.costCenter.code },
      { header: 'Cost centre', value: (r) => r.costCenter.name },
      // Only a resolvable name — the payload's requester.name is the user id.
      // "You" means nothing once the file leaves the screen, so use the real name.
      {
        header: 'Requester',
        value: (r) => (r.requester.id === me ? myName : requesterName(r.requester)) ?? '',
      },
      { header: 'Status', value: (r) => statusLabel(r.status) },
      { header: 'Priority', value: (r) => priorityLabel(r.priority) },
      { header: 'Needed by', value: (r) => (r.neededBy ? formatDate(r.neededBy) : '') },
      { header: 'Days since raised', value: (r) => r.agingDays },
      { header: 'Lines', value: (r) => r.lineCount },
      { header: 'Amount', value: (r) => r.totalAmount },
      { header: 'Currency', value: (r) => r.currency },
    ]);

  return (
    <div className="pb-20">
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
        summary={
          isLoading
            ? null
            : `${rows.length} shown${data?.truncated ? ' — first 2,000 loaded' : ''}`
        }
      />

      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line text-muted border-b text-left">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  aria-label="Select all shown requisitions"
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected}
                  onChange={selection.toggleAll}
                  disabled={rows.length === 0}
                />
              </th>
              <SortableHead label="Requisition" sortKey="number" sort={sort} onSort={toggleSort} />
              <SortableHead label="Title" sortKey="title" sort={sort} onSort={toggleSort} />
              <th className="px-3 py-2.5 text-caption font-medium">Cost centre</th>
              <SortableHead label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <SortableHead label="Priority" sortKey="priority" sort={sort} onSort={toggleSort} />
              <SortableHead label="Needed by" sortKey="neededBy" sort={sort} onSort={toggleSort} />
              <SortableHead label="Age" sortKey="aging" sort={sort} onSort={toggleSort} />
              <SortableHead
                label="Amount"
                sortKey="amount"
                sort={sort}
                onSort={toggleSort}
                numeric
              />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={9}
              isLoading={isLoading}
              error={error}
              isEmpty={rows.length === 0}
              onRetry={() => void refetch()}
              empty={
                narrowed
                  ? {
                      title: 'No requisitions match these filters',
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
                  : {
                      title: TAB_EMPTY[tab].title,
                      detail: TAB_EMPTY[tab].detail,
                      action:
                        tab === 'draft' ? (
                          <Button asChild variant="secondary" size="sm">
                            <Link href="/requisitions/new">New requisition</Link>
                          </Button>
                        ) : undefined,
                    }
              }
            />
            {rows.map((pr) => {
              const isSel = selection.isSelected(pr.id);
              const requester = requesterName(pr.requester);
              return (
                <tr
                  key={pr.id}
                  className={cn(
                    'border-line duration-hover border-b transition-colors',
                    isSel ? 'bg-accent-wash/60' : 'hover:bg-canvas/60',
                  )}
                >
                  <td className="px-3 py-3.5">
                    <Checkbox
                      aria-label={`Select ${pr.number}`}
                      checked={isSel}
                      onChange={() => selection.toggle(pr.id)}
                    />
                  </td>
                  <td className="px-3 py-3.5">
                    <Link
                      href={`/requisitions/${pr.id}`}
                      className="font-numeric text-ink hover:text-accent font-medium"
                    >
                      {pr.number}
                    </Link>
                    {requester && (
                      <div className="text-faint text-micro">Raised by {requester}</div>
                    )}
                  </td>
                  <td className="text-text max-w-[320px] px-3 py-3.5">
                    <span className="line-clamp-2">{pr.title}</span>
                  </td>
                  <td className="text-muted px-3 py-3.5 text-caption">{pr.costCenter.name}</td>
                  <td className="px-3 py-3.5">
                    <Pill variant={statusVariant(pr.status)} dot>
                      {statusLabel(pr.status)}
                    </Pill>
                  </td>
                  <td className="px-3 py-3.5">
                    {pr.priority === 'STANDARD' ? (
                      <span className="text-muted text-caption">Standard</span>
                    ) : (
                      <Badge variant={priorityVariant(pr.priority)}>
                        {priorityLabel(pr.priority)}
                      </Badge>
                    )}
                  </td>
                  <td className="font-numeric text-text px-3 py-3.5">
                    {pr.neededBy ? formatDate(pr.neededBy) : '—'}
                  </td>
                  <td className="font-numeric text-text px-3 py-3.5">{pr.agingDays}d</td>
                  <td className="font-numeric text-ink px-3 py-3.5 text-right font-medium">
                    {inr(pr.totalAmount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BulkActionBar
        count={selection.count}
        noun="requisition"
        onClear={selection.clear}
        note={
          tab === 'my_approval' ? (
            // Decide needs each requisition's approval id, which list rows
            // do not carry — the Approvals queue is where that happens in bulk.
            <Link href="/inbox" className="hover:text-white underline underline-offset-2">
              Approve or reject in your Approvals inbox
            </Link>
          ) : undefined
        }
      >
        {canSubmit && selectedDrafts.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setConfirmSubmit(true)}>
            Submit {selectedDrafts.length} for approval
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={exportSelected}>
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </Button>
      </BulkActionBar>

      <BulkSubmitDialog
        rows={selectedDrafts}
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        onDone={(ok, failed) => {
          const total = ok + failed.length;
          toast(
            failed.length === 0
              ? `Submitted ${ok} requisition${ok === 1 ? '' : 's'} for approval.`
              : `Submitted ${ok} of ${total}. ${failed.length} failed: ${failed[0]}`,
            failed.length ? 'error' : 'success',
          );
          if (failed.length === 0) selection.clear();
        }}
      />
    </div>
  );
}

/**
 * Submits drafts one at a time via POST /requisitions/:id/submit — there is no
 * bulk endpoint. Each call is its own transaction, so a failure part-way leaves
 * the earlier ones submitted and the result says exactly how many went.
 */
function BulkSubmitDialog({
  rows,
  open,
  onOpenChange,
  onDone,
}: {
  rows: RequisitionCardView[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (ok: number, failed: string[]) => void;
}): React.JSX.Element {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const run = async (): Promise<void> => {
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const r of rows) {
      try {
        await apiFetch(`/requisitions/${r.id}/submit`, { method: 'POST' });
        ok += 1;
      } catch (e) {
        const err = e as { message?: string; title?: string };
        failed.push(`${r.number}: ${err.message || err.title || 'Request failed'}`);
      }
    }
    setBusy(false);
    await qc.invalidateQueries({ queryKey: requisitionKeys.all });
    onDone(ok, failed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogTitle>
          Submit {rows.length} draft{rows.length === 1 ? '' : 's'} for approval?
        </DialogTitle>
        <DialogDescription className="mt-1">
          Each goes to the approvers on your approval matrix and can no longer be edited unless an
          approver sends it back.
        </DialogDescription>
        <ul className="border-line divide-line mt-4 max-h-56 divide-y overflow-y-auto rounded-sm border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-body-sm">
              <span className="min-w-0 truncate">
                <span className="font-numeric text-ink font-medium">{r.number}</span>{' '}
                <span className="text-muted">{r.title}</span>
              </span>
              <span className="font-numeric text-text shrink-0">{inr(r.totalAmount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void run()} disabled={busy || rows.length === 0}>
            {busy ? 'Submitting…' : 'Submit for approval'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
