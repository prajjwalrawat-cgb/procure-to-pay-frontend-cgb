'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  FilterBar,
  Input,
  PageHeader,
  SortableHead,
  StatusText,
  SubNav,
  TableState,
  matchesFilters,
  optionsFrom,
  useFilters,
  useSort,
  type FilterDef,
} from '@/components/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { OnboardingListItem } from '@/lib/shared';
import { MsmeBadge, useCategoryLabel } from '@/components/vendors/vendor-badges';
import {
  useCancelOnboarding,
  useOnboardingQueue,
  type OnboardingTab,
} from '@/lib/api/vendors';
import { formatDate, humanise } from '@/lib/format';
import { useHasPermission } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/shared';
import { useToastStore } from '@/store/toast-store';

const TABS: { key: OnboardingTab; label: string }[] = [
  { key: 'my_review', label: 'Awaiting my review' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

type Sla = 'breached' | 'due' | 'ok' | 'none';

/** Where the review SLA stands: breached, due within a day, or on track. */
function slaState(breachAt: string | null): Sla {
  if (!breachAt) return 'none';
  const hrs = (new Date(breachAt).getTime() - Date.now()) / 3_600_000;
  if (hrs < 0) return 'breached';
  if (hrs < 24) return 'due';
  return 'ok';
}

const SLA_VARIANT: Record<Sla, 'danger' | 'warn' | 'success' | 'neutral'> = {
  breached: 'danger',
  due: 'warn',
  ok: 'success',
  none: 'neutral',
};
const SLA_LABEL: Record<Sla, string> = {
  breached: 'Breached',
  due: 'Due within 24h',
  ok: 'On track',
  none: 'No SLA',
};

type SortKey = 'vendor' | 'progress' | 'docs' | 'days' | 'sla';
const SORT: Record<SortKey, (o: OnboardingListItem) => string | number | null> = {
  vendor: (o) => o.vendorName,
  progress: (o) => o.completionPct,
  docs: (o) => (o.docsRequired ? o.docsVerified / o.docsRequired : null),
  days: (o) => o.daysOpen,
  sla: (o) => (o.slaBreachAt ? new Date(o.slaBreachAt).getTime() : null),
};

function filterValue(o: OnboardingListItem, key: string): string | number | null {
  switch (key) {
    case 'category':
      return o.category ?? 'none';
    case 'source':
      return o.invitationSource;
    case 'msme':
      return o.isMsme ? 'yes' : 'no';
    case 'sla':
      return slaState(o.slaBreachAt);
    case 'stalled':
      return o.stalled ? 'yes' : 'no';
    default:
      return null;
  }
}

/** Confirms a withdrawal and captures the reason that lands in the audit log. */
function CancelInviteDialog({
  row,
  onClose,
}: {
  row: OnboardingListItem | null;
  onClose: () => void;
}): React.JSX.Element {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const cancel = useCancelOnboarding();
  const toast = useToastStore((s) => s.push);

  const submit = (): void => {
    if (!row) return;
    if (reason.trim().length < 3) {
      setError('Give a reason — it is recorded in the audit log');
      return;
    }
    setError('');
    cancel.mutate(
      { onboardingId: row.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast(`Invitation to ${row.vendorName} withdrawn`, 'success');
          setReason('');
          onClose();
        },
        onError: (e) => toast(e.message || 'Could not cancel the invitation', 'error'),
      },
    );
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Cancel invitation</DialogTitle>
        <DialogDescription>
          Withdraws the invitation to <strong>{row?.vendorName}</strong>. They never set a
          password, so nothing they can use goes away — the link simply stops working and
          the vendor record is archived. Nothing is deleted, and the reason is recorded in
          the audit log.
        </DialogDescription>
        <Field label="Reason" htmlFor="cancel-reason" error={error} className="mt-4">
          <Input
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Duplicate invite — vendor already onboarding under VN-XXXXXX"
            aria-invalid={!!error}
          />
        </Field>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Keep invitation
          </Button>
          <Button variant="danger" onClick={submit} disabled={cancel.isPending}>
            {cancel.isPending ? 'Cancelling…' : 'Cancel invitation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function OnboardingQueuePage(): React.JSX.Element {
  const [tab, setTab] = useState<OnboardingTab>('my_review');
  const [cancelling, setCancelling] = useState<OnboardingListItem | null>(null);
  const [search, setSearch] = useState('');
  const filters = useFilters();
  const canReview = useHasPermission(PERMISSIONS.VENDOR_ONBOARDING_REVIEW);
  const categoryLabel = useCategoryLabel();

  // Viewers who are never routed an onboarding (finance watching the pipeline)
  // have nothing in "Awaiting my review" — drop the tab and land them on the
  // live queue. Derived rather than stored, because the session roles arrive
  // after the first render and would otherwise pin a reviewer to the fallback.
  const tabs = canReview ? TABS : TABS.filter((t) => t.key !== 'my_review');
  const activeTab: OnboardingTab =
    tab === 'my_review' && !canReview ? 'in_progress' : tab;
  const { data, isLoading, isError, error, refetch } = useOnboardingQueue(activeTab);

  const items = useMemo(() => data?.items ?? [], [data]);

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: [
          ...optionsFrom(items, (o) =>
            o.category
              ? { value: o.category, label: categoryLabel(o.category) ?? '' }
              : null,
          ),
          { value: 'none', label: 'Uncategorised' },
        ],
      },
      {
        key: 'source',
        label: 'Source',
        type: 'select',
        options: optionsFrom(items, (o) => ({
          value: o.invitationSource,
          label: humanise(o.invitationSource),
        })),
      },
      {
        key: 'sla',
        label: 'SLA',
        type: 'select',
        options: (['breached', 'due', 'ok', 'none'] as Sla[]).map((s) => ({
          value: s,
          label: SLA_LABEL[s],
        })),
      },
      {
        key: 'msme',
        label: 'MSME',
        type: 'select',
        options: [
          { value: 'yes', label: 'MSME only' },
          { value: 'no', label: 'Non-MSME only' },
        ],
      },
      {
        key: 'stalled',
        label: 'Stalled',
        type: 'select',
        options: [
          { value: 'yes', label: 'Stalled only' },
          { value: 'no', label: 'Moving only' },
        ],
      },
    ],
    [items, categoryLabel],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (o) =>
        (!q || o.vendorName.toLowerCase().includes(q)) &&
        matchesFilters(o, defs, filters.values, filterValue),
    );
  }, [items, search, defs, filters.values]);

  const { sorted: rows, sort, toggle } = useSort(filtered, SORT);
  const narrowed = search.trim() !== '' || filters.activeCount > 0;
  // The actions column only exists when a shown row can be withdrawn; an
  // always-empty column would add a blank line to every stacked phone card.
  const anyCancel = rows.some((o) => o.canCancel);

  return (
    <div>
      <PageHeader
        title="Onboarding queue"
        breadcrumbs={[{ label: 'Vendors', href: '/vendors' }, { label: 'Onboarding' }]}
        description="Invited and self-registered vendors working through the onboarding wizard."
      />

      <SubNav
        className="mb-4"
        items={tabs.map((t) => ({ key: t.key, label: t.label }))}
        value={activeTab}
        onChange={(k) => setTab(k as typeof activeTab)}
      />

      <FilterBar
        defs={defs}
        filters={filters}
        search={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor…"
            aria-label="Search onboarding queue"
          />
        }
        summary={isLoading ? null : `${rows.length} shown`}
      />

      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-b border-line text-left text-muted">
            <tr>
              <SortableHead label="Vendor" sortKey="vendor" sort={sort} onSort={toggle} />
              <th className="px-3 py-2.5 text-caption font-medium">Category</th>
              <th className="px-3 py-2.5 text-caption font-medium">Source</th>
              <SortableHead
                label="Progress"
                sortKey="progress"
                sort={sort}
                onSort={toggle}
              />
              <SortableHead
                label="Docs verified"
                sortKey="docs"
                sort={sort}
                onSort={toggle}
              />
              <SortableHead
                label="Days open"
                sortKey="days"
                sort={sort}
                onSort={toggle}
                numeric
              />
              <SortableHead label="SLA" sortKey="sla" sort={sort} onSort={toggle} />
              {anyCancel && <th className="px-3 py-2.5 text-caption font-medium" />}
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={anyCancel ? 8 : 7}
              isLoading={isLoading}
              error={isError ? error : undefined}
              isEmpty={rows.length === 0}
              onRetry={() => void refetch()}
              empty={
                narrowed
                  ? {
                      title: 'No onboardings match these filters',
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
                  : activeTab === 'my_review'
                    ? {
                        title: 'Nothing waiting on you',
                        detail:
                          'Onboardings routed to you for review land here once the vendor submits.',
                      }
                    : activeTab === 'all'
                      ? {
                          title: 'No onboardings yet',
                          detail:
                            'Invite a vendor from the Vendors page — their onboarding shows up here from the moment the invitation goes out.',
                          action: (
                            <Button asChild variant="secondary" size="sm">
                              <Link href="/vendors">Go to vendors</Link>
                            </Button>
                          ),
                        }
                      : {
                          title: 'Nothing in this view',
                          detail: 'No onboardings are in this state right now.',
                        }
              }
            />
            {rows.map((o) => {
              const sla = slaState(o.slaBreachAt);
              return (
                <tr
                  key={o.id}
                  className="border-b border-line transition-colors duration-hover hover:bg-canvas/60"
                >
                  <td className="px-3 py-3.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={`/vendors/onboarding/${o.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {o.vendorName}
                      </Link>
                      {o.isMsme && <MsmeBadge />}
                    </div>
                    <div className="flex flex-wrap gap-x-2">
                      {o.stalled && <StatusText variant="warn">Stalled</StatusText>}
                      {o.reviewDecision === 'CANCELLED' && (
                        <StatusText variant="neutral">Cancelled</StatusText>
                      )}
                      {/* Sits in this tab while the vendor fixes what was asked
                          for — the row is not waiting on a reviewer, and without
                          the marker it is indistinguishable from one that is. */}
                      {o.reviewDecision === 'RETURNED_FOR_INFO' && (
                        <StatusText variant="warn">With vendor</StatusText>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-muted">
                    {categoryLabel(o.category) ?? '—'}
                  </td>
                  <td className="px-3 py-3.5 text-muted">
                    {humanise(o.invitationSource)}
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 w-20 overflow-hidden rounded-full bg-canvas"
                        role="progressbar"
                        aria-valuenow={o.completionPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${o.vendorName} onboarding progress`}
                      >
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${o.completionPct}%` }}
                        />
                      </div>
                      <span className="font-numeric text-muted">{o.completionPct}%</span>
                    </div>
                  </td>
                  <td className="font-numeric px-3 py-3.5 text-muted">
                    {o.docsVerified}/{o.docsRequired}
                  </td>
                  <td className="font-numeric px-3 py-3.5 text-right text-muted">
                    {o.daysOpen}d
                  </td>
                  <td className="px-3 py-3.5">
                    <div>
                      <StatusText variant={SLA_VARIANT[sla]}>
                        {o.slaBreachAt ? formatDate(o.slaBreachAt) : 'No SLA'}
                      </StatusText>
                      {o.slaBreachAt && (
                        <div className="text-micro text-faint">{SLA_LABEL[sla]}</div>
                      )}
                    </div>
                  </td>
                  {anyCancel && (
                    <td className="px-3 py-3.5 text-right">
                      {o.canCancel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCancelling(o)}
                        >
                          Cancel invite
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CancelInviteDialog row={cancelling} onClose={() => setCancelling(null)} />
    </div>
  );
}
