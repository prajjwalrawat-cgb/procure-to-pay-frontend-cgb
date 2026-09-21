'use client';

/**
 * The enterprise list toolkit — one implementation of the things every data
 * table in the product needs, so Invoices, Purchase orders, Requisitions and
 * the rest behave identically:
 *
 *   Checkbox / useSelection / BulkActionBar   row selection that *does* something
 *   useSort / SortableHead                    click-to-sort columns, aria-sort
 *   useFilters / FilterBar                    a filter drawer + removable chips,
 *                                             combinable with the page's tabs
 *   ExpandToggle                              inline row expansion
 *   SkeletonCards                             loading state for card grids
 *
 * Sorting and filtering run over the rows the page has loaded. The list hooks
 * fetch every page (lib/api/paginate.ts) so that is the whole set, not the
 * first 50 — the API has no sort parameter and most filters are not applied
 * server-side, so client-side is the honest place to do it.
 *
 * Tables also collapse to stacked cards below 768px: give the <table> the
 * `pf-stack` class and the shell labels each cell from its column header
 * (see useTableStackLabels in app-shell.tsx and `.pf-stack` in styles.css).
 */

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronsUpDown, SlidersHorizontal, X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Button } from './button';
import { Skeleton } from './data-state';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';

// ── Selection ────────────────────────────────────────────────────────────────

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean;
}

/** Native checkbox in the accent colour, with a real indeterminate state. */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, ...props }, ref) => {
    const inner = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => inner.current as HTMLInputElement);
    React.useEffect(() => {
      if (inner.current) inner.current.indeterminate = !!indeterminate && !props.checked;
    }, [indeterminate, props.checked]);
    return (
      <input
        ref={inner}
        type="checkbox"
        className={cn(
          'border-line h-4 w-4 shrink-0 cursor-pointer rounded-xs accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Checkbox.displayName = 'Checkbox';

export interface Selection {
  selected: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Header checkbox: selects every visible row, or clears them all. */
  toggleAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  clear: () => void;
  count: number;
}

/**
 * Selection over the rows currently shown. Ids that drop out of view (a tab
 * change, a filter) are pruned, so a bulk action can never act on a row the
 * user can no longer see.
 */
export function useSelection(visibleIds: string[]): Selection {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const key = visibleIds.join('|');

  React.useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(visibleIds);
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  return {
    selected,
    isSelected: (id) => selected.has(id),
    toggle: (id) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleAll: () => setSelected(allSelected ? new Set() : new Set(visibleIds)),
    allSelected,
    someSelected: selected.size > 0 && !allSelected,
    clear: () => setSelected(new Set()),
    count: selected.size,
  };
}

/**
 * Floats above the bottom of the viewport while rows are selected. Fixed rather
 * than inline so it stays reachable on a long list and never shifts the table
 * down when it appears.
 */
export function BulkActionBar({
  count,
  noun = 'item',
  onClear,
  children,
  note,
}: {
  count: number;
  noun?: string;
  onClear: () => void;
  /** The actions — secondary buttons, at most one primary. */
  children: React.ReactNode;
  /** Optional muted line, e.g. why an action is unavailable. */
  note?: React.ReactNode;
}): React.JSX.Element | null {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="bg-ink text-white flex max-w-full flex-wrap items-center gap-2 rounded-lg px-3 py-2 shadow-xl">
        <span className="font-numeric px-1 text-body-sm font-medium">
          {count} {noun}
          {count === 1 ? '' : 's'} selected
        </span>
        <span aria-hidden className="bg-white/20 mx-1 h-5 w-px" />
        <div className="flex flex-wrap items-center gap-1.5 [&_button]:border-white/20 [&_button]:bg-white/10 [&_button]:text-white [&_button:hover]:bg-white/20">
          {children}
        </div>
        {note && <span className="text-white/70 px-1 text-caption">{note}</span>}
        <button
          type="button"
          onClick={onClear}
          className="text-white/70 hover:text-white ml-1 rounded-sm p-1"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

// ── Sorting ──────────────────────────────────────────────────────────────────

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}
type SortValue = string | number | Date | null | undefined;

/**
 * Client-side sort. `accessors` maps a column key to the value it sorts by;
 * numbers and dates compare numerically, strings with locale collation. Nulls
 * always sink to the bottom whichever way the column runs.
 */
export function useSort<T, K extends string>(
  rows: T[],
  accessors: Record<K, (row: T) => SortValue>,
  initial: SortState<K> | null = null,
): {
  sorted: T[];
  sort: SortState<K> | null;
  toggle: (key: K) => void;
} {
  const [sort, setSort] = React.useState<SortState<K> | null>(initial);
  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const get = accessors[sort.key];
    const norm = (v: SortValue): number | string | null => {
      if (v === null || v === undefined || v === '') return null;
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'number') return v;
      const n = Number(v);
      return Number.isFinite(n) && /^-?[\d.]+$/.test(v) ? n : v;
    };
    return [...rows].sort((a, b) => {
      const x = norm(get(a));
      const y = norm(get(b));
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const c =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y), undefined, { numeric: true });
      return sort.dir === 'asc' ? c : -c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  return {
    sorted,
    sort,
    // Click cycles: descending first (the useful end for amount and aging),
    // then ascending, then back to the server's order.
    toggle: (key) =>
      setSort((s) =>
        !s || s.key !== key ? { key, dir: 'desc' } : s.dir === 'desc' ? { key, dir: 'asc' } : null,
      ),
  };
}

/** A column header that sorts. Renders the <th> itself. */
export function SortableHead<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  numeric,
  className,
}: {
  label: React.ReactNode;
  sortKey: K;
  sort: SortState<K> | null;
  onSort: (key: K) => void;
  numeric?: boolean;
  className?: string;
}): React.JSX.Element {
  const active = sort?.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-3 py-2.5 text-caption font-medium', numeric && 'text-right', className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'hover:text-text duration-hover -mx-1 inline-flex items-center gap-1 rounded-xs px-1 transition-colors',
          numeric && 'flex-row-reverse',
          active ? 'text-text' : 'text-muted',
        )}
      >
        {label}
        <Icon className={cn('h-3 w-3 shrink-0', !active && 'opacity-50')} aria-hidden />
      </button>
    </th>
  );
}

// ── Row expansion ────────────────────────────────────────────────────────────

export function ExpandToggle({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  /** What is being expanded, for the accessible name — e.g. "INV-4408". */
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
      onClick={onToggle}
      className="text-muted hover:bg-canvas hover:text-text rounded-sm p-1"
    >
      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  );
}

// ── Filters ──────────────────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
}

export type FilterDef =
  | { key: string; label: string; type: 'select'; options: FilterOption[] }
  | { key: string; label: string; type: 'amount' }
  | { key: string; label: string; type: 'date' }
  | { key: string; label: string; type: 'number'; unit?: string };

/** select → option value; amount/number → [min, max]; date → [from, to] (ISO). */
export type FilterValue = string | [string, string];
export type FilterValues = Record<string, FilterValue | undefined>;

function isActive(v: FilterValue | undefined): v is FilterValue {
  if (v === undefined) return false;
  if (typeof v === 'string') return v !== '';
  return v[0] !== '' || v[1] !== '';
}

export function useFilters(): {
  values: FilterValues;
  set: (key: string, value: FilterValue | undefined) => void;
  replace: (values: FilterValues) => void;
  clear: () => void;
  activeCount: number;
} {
  const [values, setValues] = React.useState<FilterValues>({});
  return {
    values,
    set: (key, value) => setValues((v) => ({ ...v, [key]: value })),
    replace: setValues,
    clear: () => setValues({}),
    activeCount: Object.values(values).filter(isActive).length,
  };
}

/**
 * Tests one row against the active filters. `get` returns the row's value for
 * a filter key — a string for select filters, a number for amount/number, an
 * ISO date for date. A row with no value for an active range filter is
 * excluded (it cannot be shown to be inside the range).
 */
export function matchesFilters<T>(
  row: T,
  defs: FilterDef[],
  values: FilterValues,
  get: (row: T, key: string) => string | number | null | undefined,
): boolean {
  for (const def of defs) {
    const v = values[def.key];
    if (!isActive(v)) continue;
    const actual = get(row, def.key);
    if (def.type === 'select') {
      if (String(actual ?? '') !== v) return false;
      continue;
    }
    const [lo, hi] = v as [string, string];
    if (actual === null || actual === undefined || actual === '') return false;
    if (def.type === 'date') {
      const d = String(actual).slice(0, 10);
      if (lo && d < lo) return false;
      if (hi && d > hi) return false;
    } else {
      const n = Number(actual);
      if (lo !== '' && n < Number(lo)) return false;
      if (hi !== '' && n > Number(hi)) return false;
    }
  }
  return true;
}

function chipText(def: FilterDef, v: FilterValue): string {
  if (def.type === 'select') {
    return `${def.label}: ${def.options.find((o) => o.value === v)?.label ?? v}`;
  }
  const [lo, hi] = v as [string, string];
  const fmt = (x: string): string =>
    def.type === 'amount'
      ? `₹${Number(x).toLocaleString('en-IN')}`
      : def.type === 'number'
        ? `${x}${def.unit ?? ''}`
        : x;
  if (lo && hi) return `${def.label}: ${fmt(lo)} – ${fmt(hi)}`;
  if (lo) return `${def.label}: ≥ ${fmt(lo)}`;
  return `${def.label}: ≤ ${fmt(hi)}`;
}

const fieldClass =
  'border-line bg-panel text-text focus:border-accent h-9 w-full rounded-sm border px-2.5 text-body-sm outline-none';

/**
 * The toolbar row under a list's tabs: search (passed in), a Filters button
 * that opens a drawer, and one removable chip per active filter.
 */
export function FilterBar({
  defs,
  filters,
  search,
  summary,
  actions,
}: {
  defs: FilterDef[];
  filters: ReturnType<typeof useFilters>;
  /** Usually an <Input> for free-text search. */
  search?: React.ReactNode;
  /** e.g. "31 shown" — sits after the chips. */
  summary?: React.ReactNode;
  /** Right-aligned extras, e.g. a density toggle or Export. */
  actions?: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<FilterValues>(filters.values);
  React.useEffect(() => {
    if (open) setDraft(filters.values);
  }, [open, filters.values]);

  const active = defs.filter((d) => isActive(filters.values[d.key]));

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {search && <div className="w-full sm:w-72">{search}</div>}
        {defs.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="h-9">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            Filters
            {filters.activeCount > 0 && (
              <span className="bg-accent font-numeric rounded-pill px-1.5 text-micro text-white">
                {filters.activeCount}
              </span>
            )}
          </Button>
        )}
        {summary && <span className="text-muted text-caption">{summary}</span>}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {active.map((d) => (
            <span
              key={d.key}
              className="bg-accent-wash text-accent-2 inline-flex items-center gap-1 rounded-pill py-0.5 pl-2.5 pr-1 text-caption font-medium"
            >
              {chipText(d, filters.values[d.key] as FilterValue)}
              <button
                type="button"
                onClick={() => filters.set(d.key, undefined)}
                className="hover:bg-accent/10 rounded-full p-0.5"
                aria-label={`Remove filter ${d.label}`}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
          <Button variant="link" size="sm" onClick={filters.clear} className="h-6 text-caption">
            Clear all
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="inset-y-0 left-auto right-0 top-0 flex h-full max-w-sm translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0">
          <div className="border-line border-b px-5 py-4">
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription className="mt-0.5">
              Combine with the tabs above. Applies to every loaded row.
            </DialogDescription>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {defs.map((d) => {
              const v = draft[d.key];
              const setV = (nv: FilterValue | undefined): void =>
                setDraft((prev) => ({ ...prev, [d.key]: nv }));
              const range = (Array.isArray(v) ? v : ['', '']) as [string, string];
              return (
                <fieldset key={d.key}>
                  <legend className="text-text mb-1.5 text-caption font-medium">{d.label}</legend>
                  {d.type === 'select' ? (
                    <select
                      className={fieldClass}
                      value={typeof v === 'string' ? v : ''}
                      onChange={(e) => setV(e.target.value || undefined)}
                    >
                      <option value="">Any</option>
                      {d.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        aria-label={`${d.label} from`}
                        type={d.type === 'date' ? 'date' : 'number'}
                        inputMode={d.type === 'date' ? undefined : 'decimal'}
                        placeholder={d.type === 'date' ? undefined : 'Min'}
                        className={fieldClass}
                        value={range[0]}
                        onChange={(e) => setV([e.target.value, range[1]])}
                      />
                      <span className="text-faint text-caption">to</span>
                      <input
                        aria-label={`${d.label} to`}
                        type={d.type === 'date' ? 'date' : 'number'}
                        inputMode={d.type === 'date' ? undefined : 'decimal'}
                        placeholder={d.type === 'date' ? undefined : 'Max'}
                        className={fieldClass}
                        value={range[1]}
                        onChange={(e) => setV([range[0], e.target.value])}
                      />
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>
          <div className="border-line flex items-center justify-between gap-2 border-t px-5 py-3">
            <Button variant="ghost" size="sm" onClick={() => setDraft({})}>
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                filters.replace(draft);
                setOpen(false);
              }}
            >
              Apply filters
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Distinct options for a select filter, built from the loaded rows. */
export function optionsFrom<T>(
  rows: T[],
  get: (row: T) => { value: string; label: string } | null | undefined,
): FilterOption[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    const o = get(r);
    if (o && o.value && !seen.has(o.value)) seen.set(o.value, o.label);
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ── Loading for card grids ───────────────────────────────────────────────────

export function SkeletonCards({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-line bg-panel flex flex-col gap-3 rounded-lg border p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <div className="mt-2 flex gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Stacked-card labels ──────────────────────────────────────────────────────

function labelTable(table: HTMLTableElement): void {
  const heads = Array.from(table.querySelectorAll(':scope > thead > tr:last-child > th'));
  if (heads.length === 0) return;
  const labels = heads.map((th) => (th.textContent ?? '').trim());
  const firstLabelled = labels.findIndex((l) => l !== '');
  for (const tr of Array.from(table.querySelectorAll(':scope > tbody > tr'))) {
    let col = 0;
    for (const td of Array.from(tr.children) as HTMLTableCellElement[]) {
      if (td.colSpan > 1) {
        col += td.colSpan;
        continue;
      }
      const label = labels[col] ?? '';
      if (td.getAttribute('data-label') !== label) td.setAttribute('data-label', label);
      if (col === firstLabelled) td.setAttribute('data-first', '');
      else td.removeAttribute('data-first');
      col += 1;
    }
  }
}

/**
 * Copies each `table.pf-stack` column header onto its cells as `data-label`,
 * which the stacked-card CSS prints beside the value on narrow screens. One
 * observer on the shell covers every page, including rows that arrive later.
 */
export function useTableStackLabels(root: React.RefObject<HTMLElement>): void {
  React.useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const run = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.querySelectorAll<HTMLTableElement>('table.pf-stack').forEach(labelTable);
      });
    };
    run();
    const obs = new MutationObserver(run);
    obs.observe(el, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [root]);
}
