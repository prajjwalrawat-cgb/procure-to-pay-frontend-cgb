'use client';

import { Pill } from '@/components/ui';

import { useVendorGrns } from '@/vendor/lib/api/receipts';

export default function VendorReceiptsPage(): React.JSX.Element {
  const { data, isLoading } = useVendorGrns();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-ink mb-1 text-[20px] font-semibold">Deliveries received</h1>
      <p className="text-muted mb-4 text-[13px]">
        Goods receipts against your purchase orders
      </p>

      <div className="border-line bg-panel overflow-hidden rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="bg-canvas text-faint text-left text-[11px] uppercase">
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
                <td colSpan={5} className="text-muted px-3 py-8 text-center">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (data?.items.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="text-muted px-3 py-8 text-center">
                  No deliveries recorded yet.
                </td>
              </tr>
            )}
            {data?.items.map((g) => (
              <tr key={g.id} className="border-line border-t">
                <td className="font-numeric text-ink px-3 py-2 font-medium">
                  {g.number}
                </td>
                <td className="font-numeric text-text px-3 py-2 text-[12px]">
                  {g.poNumber}
                </td>
                <td className="font-numeric text-text px-3 py-2 text-[12px]">
                  {new Date(g.receivedAt).toLocaleDateString('en-IN')}
                </td>
                <td className="px-3 py-2">
                  <Pill variant="gray">{g.qcStatus}</Pill>
                </td>
                <td className="font-numeric text-text px-3 py-2 text-right">
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
