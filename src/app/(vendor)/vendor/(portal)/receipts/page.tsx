'use client';

import { PageHeader, Pill, SortableHead, TableState, useSort } from '@/components/ui';

import { useVendorGrns } from '@/vendor/lib/api/receipts';
import { formatDate, statusLabel, statusVariant } from '@/lib/format';

type SortKey = 'number' | 'po' | 'received' | 'qc' | 'accepted';

export default function VendorReceiptsPage(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useVendorGrns();
  const rows = data?.items ?? [];
  const { sorted, sort, toggle } = useSort<(typeof rows)[number], SortKey>(
    rows,
    {
      number: (g) => g.number,
      po: (g) => g.poNumber,
      received: (g) => new Date(g.receivedAt),
      qc: (g) => g.qcStatus,
      accepted: (g) => g.acceptedPct,
    },
    { key: 'received', dir: 'desc' },
  );

  return (
    <div>
      <PageHeader
        title="Deliveries received"
        description="Goods receipts the buyer has posted against your purchase orders."
      />

      <div className="border-line bg-panel overflow-hidden rounded-lg border">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line border-b text-left">
            <tr>
              <SortableHead label="GRN" sortKey="number" sort={sort} onSort={toggle} />
              <SortableHead label="PO" sortKey="po" sort={sort} onSort={toggle} />
              <SortableHead label="Received" sortKey="received" sort={sort} onSort={toggle} />
              <SortableHead label="QC" sortKey="qc" sort={sort} onSort={toggle} />
              <SortableHead
                label="Accepted"
                sortKey="accepted"
                sort={sort}
                onSort={toggle}
                numeric
              />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={5}
              isLoading={isLoading}
              error={error}
              onRetry={() => void refetch()}
              isEmpty={rows.length === 0}
              empty={{
                title: 'No deliveries recorded yet',
                detail: 'When the buyer receives goods against one of your orders, the receipt and its quality check appear here.',
              }}
            />
            {!isLoading &&
              sorted.map((g) => (
                <tr key={g.id} className="border-line border-b last:border-0">
                  <td className="font-numeric text-ink px-3 py-3 font-medium">{g.number}</td>
                  <td className="font-numeric text-text px-3 py-3">{g.poNumber}</td>
                  <td className="font-numeric text-text px-3 py-3">
                    {formatDate(g.receivedAt)}
                  </td>
                  <td className="px-3 py-3">
                    <Pill variant={statusVariant(g.qcStatus)} dot>
                      {statusLabel(g.qcStatus)}
                    </Pill>
                  </td>
                  <td className="font-numeric text-text px-3 py-3 text-right">
                    {g.acceptedPct.toFixed(0)}%
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
