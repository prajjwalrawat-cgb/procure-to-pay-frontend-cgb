'use client';

import { PageHeader, Pill } from '@/components/ui';

import { useVendorGrns } from '@/vendor/lib/api/receipts';
import { formatDate } from '@/lib/format';

export default function VendorReceiptsPage(): React.JSX.Element {
  const { data, isLoading } = useVendorGrns();

  return (
    <div>
      <PageHeader
        title="Deliveries received"
        description="Goods receipts against your purchase orders"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead className="border-line border-b text-left text-caption text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">GRN</th>
              <th className="px-3 py-2 font-medium">PO</th>
              <th className="px-3 py-2 font-medium">Received</th>
              <th className="px-3 py-2 font-medium">QC</th>
              <th className="px-3 py-2 text-right font-medium">Accepted</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (data?.items.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  No deliveries recorded yet.
                </td>
              </tr>
            )}
            {data?.items.map((g) => (
              <tr key={g.id} className="border-t border-line">
                <td className="font-numeric px-3 py-2 font-medium text-ink">
                  {g.number}
                </td>
                <td className="font-numeric px-3 py-2 text-caption text-text">
                  {g.poNumber}
                </td>
                <td className="font-numeric px-3 py-2 text-caption text-text">
                  {formatDate(g.receivedAt)}
                </td>
                <td className="px-3 py-2">
                  <Pill variant="gray">{g.qcStatus}</Pill>
                </td>
                <td className="font-numeric px-3 py-2 text-right text-text">
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
