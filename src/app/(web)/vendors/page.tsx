'use client';

import {
  Button,
  Card,
  CardFooter,
  CardGrid,
  CardHeader,
  CardMeta,
  CardTitle,
  DataState,
  FilterBar,
  Input,
  PageHeader,
  Select,
  SkeletonCards,
  SortableHead,
  SubNav,
  TableState,
  cn,
  matchesFilters,
  optionsFrom,
  useFilters,
  type FilterDef,
  type SortState,
} from '@/components/ui';
import { LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { VendorListItem } from '@/lib/shared';

import { InviteVendorDialog } from './_components/invite-dialog';
import {
  RiskGradeChip,
  ScorecardGradeChip,
  VendorBadgeLegend,
  VendorTrustBadges,
  gradeRank,
  useCategoryLabel,
} from '@/components/vendors/vendor-badges';
import { useVendorList, type VendorTab } from '@/lib/api/vendors';
import { formatDate, inr } from '@/lib/format';
import { useHasPermission } from '@/lib/permissions';
import { PERMISSIONS, VENDOR_RISK_GRADE } from '@/lib/shared';

const TABS: { key: VendorTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'blacklisted', label: 'Blacklisted' },
  { key: 'all', label: 'All' },
];

type SortKey = 'spend' | 'risk' | 'score' | 'name' | 'last';

/**
 * Grades sort by rank rather than by letter so "A+" lands above "A", and
 * "ascending" means best first. Ungraded vendors return null, which useSort's
 * convention (and ours) sinks to the bottom either way.
 */
const SORT_VALUE: Record<SortKey, (v: VendorListItem) => string | number | null> = {
  spend: (v) => Number(v.fytdSpend),
  risk: (v) => gradeRank(v.riskGrade),
  score: (v) => gradeRank(v.scorecardGrade),
  name: (v) => v.name,
  last: (v) => (v.lastTransactionAt ? new Date(v.lastTransactionAt).getTime() : null),
};

/** The useful end of each column — where a first click on its header lands. */
const DEFAULT_DIR: Record<SortKey, 'asc' | 'desc'> = {
  spend: 'desc',
  risk: 'asc',
  score: 'asc',
  name: 'asc',
  last: 'desc',
};

/** The sort menu, phrased as the question each order answers. */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'spend:desc', label: 'FYTD spend — highest first' },
  { value: 'spend:asc', label: 'FYTD spend — lowest first' },
  { value: 'risk:asc', label: 'Risk grade — lowest risk first' },
  { value: 'risk:desc', label: 'Risk grade — highest risk first' },
  { value: 'score:asc', label: 'Scorecard — best first' },
  { value: 'score:desc', label: 'Scorecard — worst first' },
  { value: 'last:desc', label: 'Last goods receipt — most recent' },
  { value: 'last:asc', label: 'Last goods receipt — longest ago' },
  { value: 'name:asc', label: 'Name — A to Z' },
  { value: 'name:desc', label: 'Name — Z to A' },
];

function sortRows(rows: VendorListItem[], sort: SortState<SortKey>): VendorListItem[] {
  const get = SORT_VALUE[sort.key];
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    const c =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), undefined, { numeric: true });
    return sort.dir === 'asc' ? c : -c;
  });
}

// Tags are not offered: the list payload does not carry capabilityTags, and a
// filter over data the page does not have would silently match nothing.
function filterValue(v: VendorListItem, key: string): string | number | null {
  switch (key) {
    case 'category':
      return v.category ?? 'none';
    case 'risk':
      return v.riskGrade ?? 'none';
    case 'score':
      return v.scorecardGrade && v.scorecardGrade !== 'N/A' ? v.scorecardGrade : 'none';
    case 'msme':
      return v.isMsme ? 'yes' : 'no';
    case 'spend':
      return Number(v.fytdSpend);
    default:
      return null;
  }
}

const GRADE_OPTIONS = [
  ...VENDOR_RISK_GRADE.map((g) => ({ value: g, label: g })),
  { value: 'none', label: 'Not graded yet' },
];

/**
 * Vendors are a comparison view, so they are cards rather than a table: the
 * question here is "which of these suppliers do I go to", not "what happened
 * to record 4408". A card can carry the grade, the MSME status and the spend
 * side by side at a size you can actually compare across a grid; the same
 * facts in a 9-column table are a wall. The table view is there for the other
 * job — scanning a long roster down one column.
 */
export default function VendorsPage(): React.JSX.Element {
  const [tab, setTab] = useState<VendorTab>('active');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'spend', dir: 'desc' });
  const filters = useFilters();
  const { data, isLoading, isError, error, refetch } = useVendorList(tab);
  const canInvite = useHasPermission(PERMISSIONS.VENDOR_INVITE);
  const canSeeQueue = useHasPermission(PERMISSIONS.VENDOR_ONBOARDING_READ);
  const categoryLabel = useCategoryLabel();

  const items = useMemo(() => data?.items ?? [], [data]);

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: [
          ...optionsFrom(items, (v) =>
            v.category
              ? { value: v.category, label: categoryLabel(v.category) ?? '' }
              : null,
          ),
          { value: 'none', label: 'Uncategorised' },
        ],
      },
      { key: 'risk', label: 'Risk grade', type: 'select', options: GRADE_OPTIONS },
      { key: 'score', label: 'Scorecard grade', type: 'select', options: GRADE_OPTIONS },
      {
        key: 'msme',
        label: 'MSME',
        type: 'select',
        options: [
          { value: 'yes', label: 'MSME only' },
          { value: 'no', label: 'Non-MSME only' },
        ],
      },
      { key: 'spend', label: 'FYTD spend', type: 'amount' },
    ],
    [items, categoryLabel],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter(
      (v) =>
        (!q ||
          v.name.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q) ||
          (v.legalEntityName ?? '').toLowerCase().includes(q)) &&
        matchesFilters(v, defs, filters.values, filterValue),
    );
    return sortRows(filtered, sort);
  }, [items, search, defs, filters.values, sort]);

  const narrowed = search.trim() !== '' || filters.activeCount > 0;
  const clearAll = (): void => {
    filters.clear();
    setSearch('');
  };

  // Table headers toggle the same sort the menu sets: first click on a column
  // takes its most useful direction, a second click flips it.
  const onHeadSort = (key: SortKey): void =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: DEFAULT_DIR[key] },
    );

  const empty = narrowed
    ? {
        title: 'No vendors match these filters',
        detail: 'Clear a filter or change the search to see more.',
        action: (
          <Button variant="secondary" size="sm" onClick={clearAll}>
            Clear filters
          </Button>
        ),
      }
    : tab === 'active' || tab === 'all'
      ? {
          title: tab === 'all' ? 'No vendors yet' : 'No active vendors yet',
          detail:
            'Suppliers appear here once they are invited and complete onboarding. Invite one to get started.',
          action: canInvite ? (
            <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
              Invite vendor
            </Button>
          ) : undefined,
        }
      : {
          title: `No ${TABS.find((t) => t.key === tab)?.label.toLowerCase()} vendors`,
          detail: 'No suppliers are in this state right now.',
        };

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Onboarding, compliance, scorecards and lifecycle."
        actions={
          <>
            {canSeeQueue && (
              <Button asChild variant="secondary" size="sm">
                <Link href="/vendors/onboarding">Onboarding queue</Link>
              </Button>
            )}
            {canInvite && (
              <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
                Invite vendor
              </Button>
            )}
          </>
        }
      />

      <SubNav
        className="mb-4"
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
        value={tab}
        onChange={(k) => setTab(k as VendorTab)}
      />

      <FilterBar
        defs={defs}
        filters={filters}
        search={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code or legal name…"
            aria-label="Search vendors"
          />
        }
        summary={
          isLoading
            ? null
            : `${rows.length} shown${data?.truncated ? ' — first 2,000 loaded' : ''}`
        }
        actions={
          <>
            <Select
              aria-label="Sort vendors"
              value={`${sort.key}:${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':') as [SortKey, 'asc' | 'desc'];
                setSort({ key, dir });
              }}
              className="h-9 w-auto py-0"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <ViewToggle value={view} onChange={setView} />
          </>
        }
      />

      <VendorBadgeLegend className="mb-4" />

      {view === 'grid' ? (
        // Error stays distinct from empty: a 403 rendering as "no vendors"
        // reads as an empty tenant rather than as missing access.
        <div
          className={cn(
            !isLoading &&
              (isError || rows.length === 0) &&
              'rounded-lg border border-line bg-panel',
          )}
        >
          <DataState
            isLoading={isLoading}
            loading={<SkeletonCards count={6} />}
            error={isError ? error : undefined}
            isEmpty={rows.length === 0}
            onRetry={() => void refetch()}
            empty={empty}
          >
            <CardGrid>
              {rows.map((v) => (
                <VendorCard key={v.id} v={v} category={categoryLabel(v.category)} />
              ))}
            </CardGrid>
          </DataState>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="pf-stack w-full text-body-sm">
            <thead className="border-b border-line text-left text-muted">
              <tr>
                <SortableHead
                  label="Vendor"
                  sortKey="name"
                  sort={sort}
                  onSort={onHeadSort}
                />
                <th className="px-3 py-2.5 text-caption font-medium">Category</th>
                <SortableHead
                  label="Risk"
                  sortKey="risk"
                  sort={sort}
                  onSort={onHeadSort}
                />
                <SortableHead
                  label="Scorecard"
                  sortKey="score"
                  sort={sort}
                  onSort={onHeadSort}
                />
                <th className="px-3 py-2.5 text-right text-caption font-medium">
                  Active POs
                </th>
                <SortableHead
                  label="Last receipt"
                  sortKey="last"
                  sort={sort}
                  onSort={onHeadSort}
                />
                <SortableHead
                  label="FYTD spend"
                  sortKey="spend"
                  sort={sort}
                  onSort={onHeadSort}
                  numeric
                />
              </tr>
            </thead>
            <tbody>
              <TableState
                colSpan={7}
                isLoading={isLoading}
                error={isError ? error : undefined}
                isEmpty={rows.length === 0}
                onRetry={() => void refetch()}
                empty={empty}
              />
              {rows.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-line transition-colors duration-hover hover:bg-canvas/60"
                >
                  <td className="px-3 py-3.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={`/vendors/${v.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {v.name}
                      </Link>
                      <VendorTrustBadges
                        isMsme={v.isMsme}
                        lifecycleStatus={v.lifecycleStatus}
                      />
                    </div>
                    <div className="font-numeric text-micro text-faint">{v.code}</div>
                  </td>
                  <td className="px-3 py-3.5 text-muted">
                    {categoryLabel(v.category) ?? '—'}
                  </td>
                  <td className="px-3 py-3.5">
                    <RiskGradeChip grade={v.riskGrade} />
                  </td>
                  <td className="px-3 py-3.5">
                    <ScorecardGradeChip grade={v.scorecardGrade} />
                  </td>
                  <td className="font-numeric px-3 py-3.5 text-right text-text">
                    {v.activePoCount}
                  </td>
                  <td className="font-numeric px-3 py-3.5 text-muted">
                    {v.lastTransactionAt ? formatDate(v.lastTransactionAt) : 'None'}
                  </td>
                  <td className="font-numeric px-3 py-3.5 text-right font-medium text-ink">
                    {inr(v.fytdSpend, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteVendorDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

function VendorCard({
  v,
  category,
}: {
  v: VendorListItem;
  category: string | null;
}): React.JSX.Element {
  return (
    <Card interactive>
      <CardHeader
        badge={
          <VendorTrustBadges isMsme={v.isMsme} lifecycleStatus={v.lifecycleStatus} />
        }
      >
        <CardTitle>
          <Link href={`/vendors/${v.id}`} className="hover:text-accent">
            {v.name}
          </Link>
        </CardTitle>
        <CardMeta className="truncate">
          <span className="font-numeric">{v.code}</span>
          {category ? <span className="text-faint"> — {category}</span> : null}
        </CardMeta>
      </CardHeader>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 px-4 pb-4">
        <Metric label="FYTD spend">
          <span className="font-numeric text-body-sm font-medium text-ink">
            {inr(v.fytdSpend, 0)}
          </span>
        </Metric>
        <Metric label="Active POs">
          <span className="font-numeric text-body-sm font-medium text-ink">
            {v.activePoCount}
          </span>
        </Metric>
        <Metric label="Risk grade">
          <RiskGradeChip grade={v.riskGrade} />
        </Metric>
        <Metric label="Scorecard">
          <ScorecardGradeChip grade={v.scorecardGrade} />
        </Metric>
      </dl>

      <CardFooter
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href={`/vendors/${v.id}`}>View profile</Link>
          </Button>
        }
      >
        {/* lastTransactionAt is the latest GRN, not the latest PO — so it is
            named as a receipt. A vendor can carry FYTD spend on POs whose
            goods have not arrived yet. */}
        {v.lastTransactionAt
          ? `Last receipt ${formatDate(v.lastTransactionAt)}`
          : 'No goods received yet'}
      </CardFooter>
    </Card>
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <dt className="text-micro text-faint">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: 'grid' | 'table';
  onChange: (v: 'grid' | 'table') => void;
}): React.JSX.Element {
  const opts = [
    { key: 'grid' as const, label: 'Card view', Icon: LayoutGrid },
    { key: 'table' as const, label: 'Table view', Icon: List },
  ];
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex h-9 rounded-sm border border-line"
    >
      {opts.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          aria-pressed={value === key}
          title={label}
          onClick={() => onChange(key)}
          className={cn(
            'flex w-9 items-center justify-center transition-colors duration-hover first:rounded-l-sm last:rounded-r-sm',
            value === key
              ? 'bg-accent-wash text-accent'
              : 'text-muted hover:bg-canvas hover:text-text',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
