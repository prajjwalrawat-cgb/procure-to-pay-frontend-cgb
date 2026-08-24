'use client';

import { Button, PageHeader, Pill } from '@/components/ui';
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
  const { data, isLoading } = useItems({
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

  const truncated = (data?.totalEstimate ?? 0) > rows.length;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Item master"
        description={
          <>{data?.totalEstimate ?? 0} SKUs · catalogue behind requisition lines</>
        }
        actions={
          <>
            {canManage && (
              <Button
                variant="accent"
                size="sm"
                onClick={() => setTarget({ mode: 'create' })}
              >
                <Plus className="h-3.5 w-3.5" /> New item
              </Button>
            )}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search SKU, name or description…"
          className="min-w-[260px] flex-1 rounded-md border border-line bg-panel px-3 py-1.5 text-[13px] text-text outline-none placeholder:text-faint focus:border-accent"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-line bg-panel px-3 py-1.5 text-[13px] text-text outline-none"
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
          className="rounded-md border border-line bg-panel px-3 py-1.5 text-[13px] text-text outline-none"
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <table className="w-full text-[13px]">
          <thead className="bg-canvas text-left text-[11px] uppercase tracking-wide text-faint">
            <tr>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">HSN</th>
              <th className="px-3 py-2 text-right font-medium">GST</th>
              <th className="px-3 py-2 font-medium">UoM</th>
              <th className="px-3 py-2 text-right font-medium">Last paid</th>
              <th className="px-3 py-2 font-medium">Preferred vendor</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  {q || category || status !== 'all'
                    ? 'No items match this view.'
                    : 'No items in the catalogue yet.'}
                </td>
              </tr>
            )}
            {visible.map((item) => (
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
        <p className="mt-2 text-[11px] text-faint">
          Showing the first {rows.length} of {data?.totalEstimate} SKUs — narrow the
          search to see the rest.
        </p>
      )}

      <p className="mt-4 text-[12px] text-muted">
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
      <td className="font-numeric px-3 py-2 text-muted">{item.skuCode}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5 text-text">
          {item.name}
          {!item.isActive && <Pill variant="danger">inactive</Pill>}
          {item.isCapex && <Pill variant="violet">capex</Pill>}
        </div>
        {item.subcategory && (
          <div className="text-[11px] text-faint">{item.subcategory}</div>
        )}
      </td>
      <td className="px-3 py-2 text-muted">{item.category}</td>
      <td className="font-numeric px-3 py-2 text-muted">{item.hsnCode}</td>
      <td className="font-numeric px-3 py-2 text-right">{gstPercent(item.gstRate)}</td>
      <td className="px-3 py-2 text-muted">{item.primaryUom}</td>
      <td className="font-numeric px-3 py-2 text-right">
        {item.lastPaidPrice ? (
          inr(item.lastPaidPrice)
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-muted">
        {item.preferredVendor?.name ?? <span className="text-faint">—</span>}
      </td>
    </tr>
  );
}
