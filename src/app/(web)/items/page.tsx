'use client';

import {
  Badge,
  Button,
  PageHeader,
  Pill,
  SortableHead,
  TableState,
  cn,
  controlClass,
  useSort,
} from '@/components/ui';
import type { ItemListItem } from '@/lib/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { useItems } from '@/lib/api/items';
import { inr } from '@/lib/format';
import { useSessionStore } from '@/store/session-store';
import { ItemDrawer, type ItemDrawerTarget } from './_components/item-drawer';

/**
 * Item master — the catalogue behind every requisition line. Read is granted to
 * every buyer role, so the screen is browsable by all; `item:create` /
 * `item:update` sit only with Tenant Admin and Procurement Head, and the write
 * affordances are hidden accordingly (the API enforces it regardless).
 */
const MANAGE_ROLES = ['SYSADMIN', 'TENANT_ADMIN', 'PROCUREMENT_HEAD'];

type StatusFilter = 'all' | 'active' | 'inactive';

/** '0.18' → '18%'. Stored as a fraction; shown the way buyers read it. */
function gstPercent(rate: string): string {
  const n = Number(rate);
  if (!Number.isFinite(n)) return rate;
  return `${Math.round(n * 10000) / 100}%`;
}

export default function ItemMasterPage(): React.JSX.Element {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [target, setTarget] = useState<ItemDrawerTarget | null>(null);

  const roles = useSessionStore((s) => s.user?.roles ?? []);
  const canManage = roles.some((r) => MANAGE_ROLES.includes(r));

  // `q` and active-only are filtered server-side. Category is filtered here so
  // the dropdown keeps offering every category rather than collapsing to the
  // one already selected.
  const { data, isLoading, error, refetch } = useItems({
    q: q.trim() || undefined,
    activeOnly: status === 'active' || undefined,
    limit: 200,
  });

  const rows = data?.items ?? [];
  const categories = [...new Set(rows.map((i) => i.category))].sort((a, b) =>
    a.localeCompare(b),
  );
  const visible = rows.filter(
    (i) =>
      (!category || i.category === category) && (status !== 'inactive' || !i.isActive),
  );

  const { sorted, sort, toggle } = useSort(visible, {
    sku: (i) => i.skuCode,
    name: (i) => i.name,
    category: (i) => i.category,
    gst: (i) => Number(i.gstRate),
    lastPaid: (i) => (i.lastPaidPrice ? Number(i.lastPaidPrice) : null),
    vendor: (i) => i.preferredVendor?.name,
  });

  const truncated = (data?.totalEstimate ?? 0) > rows.length;

  return (
    <div>
      <PageHeader
        title="Item master"
        description={
          <>
            {data ? `${data.totalEstimate} SKUs. ` : ''}The catalogue behind requisition
            lines.
          </>
        }
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setTarget({ mode: 'create' })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> New item
            </Button>
          ) : undefined
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search SKU, name or description…"
          aria-label="Search items"
          className={cn(controlClass, 'w-full sm:w-auto sm:min-w-[16rem] sm:flex-1')}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
          className={cn(controlClass, 'w-auto min-w-0 max-w-full pr-8')}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Status"
          className={cn(controlClass, 'w-auto pr-8')}
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-b border-line text-left text-caption text-muted">
            <tr>
              <SortableHead label="SKU" sortKey="sku" sort={sort} onSort={toggle} />
              <SortableHead label="Item" sortKey="name" sort={sort} onSort={toggle} />
              <SortableHead
                label="Category"
                sortKey="category"
                sort={sort}
                onSort={toggle}
              />
              <th className="px-3 py-2.5 font-medium">HSN</th>
              <SortableHead
                label="GST"
                sortKey="gst"
                sort={sort}
                onSort={toggle}
                numeric
              />
              <th className="px-3 py-2.5 font-medium">UoM</th>
              <SortableHead
                label="Last paid"
                sortKey="lastPaid"
                sort={sort}
                onSort={toggle}
                numeric
              />
              <SortableHead
                label="Preferred vendor"
                sortKey="vendor"
                sort={sort}
                onSort={toggle}
              />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={8}
              isLoading={isLoading}
              error={error}
              onRetry={() => void refetch()}
              isEmpty={visible.length === 0}
              empty={
                q || category || status !== 'all'
                  ? {
                      title: 'No items match this view',
                      detail: 'Clear the search or filters to see the whole catalogue.',
                    }
                  : {
                      title: 'No items in the catalogue yet',
                      detail: canManage
                        ? 'Add the first SKU so requisitions can pick it.'
                        : 'A procurement head or tenant admin adds SKUs here.',
                    }
              }
            />
            {sorted.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onOpen={() => setTarget({ mode: 'edit', id: item.id })}
              />
            ))}
          </tbody>
        </table>
      </div>

      {truncated && (
        <p className="mt-2 text-caption text-muted">
          Showing the first {rows.length} of {data?.totalEstimate} SKUs — narrow the
          search to see the rest.
        </p>
      )}

      <p className="mt-4 text-caption text-muted">
        Requisition lines raised with the <strong>New product</strong> reason code are
        asking for a SKU that belongs here. Adding it lets the next requisition pick the
        item instead, which is what carries HSN, GST, UoM and inventory balances through
        to the PO and GRN.
      </p>

      <ItemDrawer target={target} canManage={canManage} onClose={() => setTarget(null)} />
    </div>
  );
}

function ItemRow({
  item,
  onOpen,
}: {
  item: ItemListItem;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <tr onClick={onOpen} className="cursor-pointer border-t border-line hover:bg-canvas">
      <td className="font-numeric px-3 py-3.5 text-muted">{item.skuCode}</td>
      <td className="px-3 py-3.5">
        <div className="flex flex-wrap items-center gap-1.5 text-text">
          {item.name}
          {!item.isActive && <Pill variant="neutral">Inactive</Pill>}
          {item.isCapex && <Badge variant="classification">Capex</Badge>}
        </div>
        {item.subcategory && (
          <div className="text-caption text-faint">{item.subcategory}</div>
        )}
      </td>
      <td className="px-3 py-3.5 text-muted">{item.category}</td>
      <td className="font-numeric px-3 py-3.5 text-muted">{item.hsnCode}</td>
      <td className="font-numeric px-3 py-3.5 text-right">{gstPercent(item.gstRate)}</td>
      <td className="px-3 py-3.5 text-muted">{item.primaryUom}</td>
      <td className="font-numeric px-3 py-3.5 text-right">
        {item.lastPaidPrice ? (
          inr(item.lastPaidPrice)
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className="px-3 py-3.5 text-muted">
        {item.preferredVendor?.name ?? <span className="text-faint">—</span>}
      </td>
    </tr>
  );
}
