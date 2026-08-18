'use client';

import { Button, PageHeader, Pill, TableState } from '@/components/ui';
import type { GrnListItem } from '@/lib/shared';
import Link from 'next/link';
import { useState } from 'react';

import { usePendingReceiptPos, useReceipts, type GrnTab } from '@/lib/api/receipts';
import { inr, statusLabel, statusVariant } from '@/lib/format';
import { tenantSuffix, useTenantName } from '@/store/session-store';

const TABS: { key: GrnTab; label: string }[] = [
  { key: 'pending_receipt', label: 'Pending receipt' },
  { key: 'awaiting_qc', label: 'Awaiting QC' },
  { key: 'posted_today', label: 'Posted today' },
  { key: 'held', label: 'Held' },
  { key: 'all', label: 'All' },
];

export default function GoodsReceiptPage(): React.JSX.Element {
  const tenantName = useTenantName();
  const [tab, setTab] = useState<GrnTab>('pending_receipt');
  const { data, isLoading } = useReceipts(tab);
  const pendingPos = usePendingReceiptPos();
  const counts = data?.counts;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Receipts"
        description={`Goods receipt & QC${tenantSuffix(tenantName)}`}
        actions={
          <Link href="/goods-receipt/new">
            <Button variant="primary" size="sm">
              New receipt
            </Button>
          </Link>
        }
      />

      <div className="border-line mb-3 flex items-center gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'duration-hover flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ' +
              (tab === t.key
                ? 'border-accent text-ink'
                : 'text-muted hover:text-text border-transparent')
            }
          >
            {t.label}
            <span className="font-numeric text-faint text-[11px]">
              {t.key === 'pending_receipt'
                ? (pendingPos.data?.totalEstimate ?? 0)
                : (counts?.[t.key] ?? 0)}
            </span>
          </button>
        ))}
      </div>

      {tab === 'pending_receipt' ? (
        <PendingReceiptTable
          items={pendingPos.data?.items ?? []}
          isLoading={pendingPos.isLoading}
        />
      ) : (
        <ReceiptsTable items={data?.items ?? []} isLoading={isLoading} />
      )}
    </div>
  );
}

interface PendingPo {
  id: string;
  number: string;
  vendor: { name: string };
  status: string;
  totalAmount: string;
  expectedDeliveryDate: string | null;
}

function PendingReceiptTable({
  items,
  isLoading,
}: {
  items: PendingPo[];
  isLoading: boolean;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel overflow-x-auto rounded-lg border">
      <table className="w-full text-[13px]">
        <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 font-medium">PO</th>
            <th className="px-3 py-2 font-medium">Vendor</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Expected</th>
            <th className="px-3 py-2 text-right font-medium">Value</th>
            <th className="w-24 px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          <TableState
            colSpan={6}
            isLoading={isLoading}
            isEmpty={items.length === 0}
            empty={{
              title: 'Nothing awaiting receipt',
              detail:
                'Issued purchase orders with outstanding quantities will appear here.',
            }}
          />
          {items.map((po) => (
            <tr key={po.id} className="border-line hover:bg-canvas/60 border-t">
              <td className="font-numeric text-ink px-3 py-2 font-medium">{po.number}</td>
              <td className="text-text px-3 py-2">{po.vendor.name}</td>
              <td className="px-3 py-2">
                <Pill variant={statusVariant(po.status)} dot>
                  {statusLabel(po.status)}
                </Pill>
              </td>
              <td className="font-numeric text-text px-3 py-2 text-[12px]">
                {po.expectedDeliveryDate
                  ? new Date(po.expectedDeliveryDate).toLocaleDateString('en-IN')
                  : '—'}
              </td>
              <td className="font-numeric text-ink px-3 py-2 text-right font-medium">
                {inr(po.totalAmount)}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/goods-receipt/new?po=${po.id}`}
                  className="text-accent-2 text-[12px] font-medium hover:underline"
                >
                  Receive →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReceiptsTable({
  items,
  isLoading,
}: {
  items: GrnListItem[];
  isLoading: boolean;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel overflow-x-auto rounded-lg border">
      <table className="w-full text-[13px]">
        <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 font-medium">GRN</th>
            <th className="px-3 py-2 font-medium">PO</th>
            <th className="px-3 py-2 font-medium">Vendor</th>
            <th className="px-3 py-2 font-medium">QC</th>
            <th className="px-3 py-2 font-medium">Received</th>
            <th className="px-3 py-2 text-right font-medium">Accepted</th>
            <th className="px-3 py-2 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          <TableState
            colSpan={7}
            isLoading={isLoading}
            isEmpty={items.length === 0}
            empty={{
              title: 'No receipts in this view',
              detail: 'Goods receipts posted against your orders will be listed here.',
            }}
          />
          {items.map((g) => (
            <tr key={g.id} className="border-line hover:bg-canvas/60 border-t">
              <td className="px-3 py-2">
                <Link
                  href={`/goods-receipt/${g.id}`}
                  className="font-numeric text-ink font-medium"
                >
                  {g.number}
                </Link>
                <div className="mt-0.5">
                  <Pill variant={statusVariant(g.status)} dot>
                    {statusLabel(g.status)}
                  </Pill>
                </div>
              </td>
              <td className="font-numeric text-text px-3 py-2 text-[12px]">
                {g.po.number}
              </td>
              <td className="px-3 py-2">
                <span className="text-text">{g.vendor.name}</span>
                {g.vendor.isMsme && (
                  <Pill variant="violet" className="ml-1.5">
                    MSME
                  </Pill>
                )}
              </td>
              <td className="px-3 py-2">
                <Pill variant={statusVariant(g.qcStatus)}>{statusLabel(g.qcStatus)}</Pill>
              </td>
              <td className="font-numeric text-text px-3 py-2 text-[12px]">
                {new Date(g.receivedAt).toLocaleDateString('en-IN')}
              </td>
              <td className="font-numeric text-text px-3 py-2 text-right">
                {g.acceptedPct.toFixed(0)}%
              </td>
              <td className="font-numeric text-ink px-3 py-2 text-right font-medium">
                {inr(g.totalValue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
