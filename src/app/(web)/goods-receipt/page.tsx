'use client';

import {
  Badge,
  Button,
  PageHeader,
  Pill,
  SubNav,
  TableState,
} from '@/components/ui';
import type { GrnListItem } from '@/lib/shared';
import Link from 'next/link';
import { useState } from 'react';

import { usePendingReceiptPos, useReceipts, type GrnTab } from '@/lib/api/receipts';
import { formatDate, inr, statusLabel, statusVariant } from '@/lib/format';

const TABS: { key: GrnTab; label: string }[] = [
  { key: 'pending_receipt', label: 'Pending receipt' },
  { key: 'awaiting_qc', label: 'Awaiting QC' },
  { key: 'posted_today', label: 'Posted today' },
  { key: 'held', label: 'Held' },
  { key: 'all', label: 'All' },
];

export default function GoodsReceiptPage(): React.JSX.Element {
  const [tab, setTab] = useState<GrnTab>('pending_receipt');
  const { data, isLoading } = useReceipts(tab);
  const pendingPos = usePendingReceiptPos();
  const counts = data?.counts;

  return (
    <div>
      <PageHeader
        title="Receipts"
        description="Goods receipt & QC"
        actions={
          <Link href="/goods-receipt/new">
            <Button variant="primary" size="sm">
              New receipt
            </Button>
          </Link>
        }
      />

      <SubNav
        className="mb-3"
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count:
            t.key === 'pending_receipt'
              ? (pendingPos.data?.totalEstimate ?? 0)
              : (counts?.[t.key] ?? 0),
        }))}
        value={tab}
        onChange={(k) => setTab(k as (typeof TABS)[number]['key'])}
      />

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
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead className="border-line border-b text-left text-caption text-muted">
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
              <td className="font-numeric text-text px-3 py-2 text-caption">
                {po.expectedDeliveryDate
                  ? formatDate(po.expectedDeliveryDate)
                  : '—'}
              </td>
              <td className="font-numeric text-ink px-3 py-2 text-right font-medium">
                {inr(po.totalAmount)}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/goods-receipt/new?po=${po.id}`}
                  className="text-accent-2 text-caption font-medium hover:underline"
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
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead className="border-line border-b text-left text-caption text-muted">
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
              <td className="font-numeric text-text px-3 py-2 text-caption">
                {g.po.number}
              </td>
              <td className="px-3 py-2">
                <span className="text-text">{g.vendor.name}</span>
                {g.vendor.isMsme && (
                  <Badge variant="classification" className="ml-1.5">MSME</Badge>
                )}
              </td>
              <td className="px-3 py-2">
                <Pill variant={statusVariant(g.qcStatus)}>{statusLabel(g.qcStatus)}</Pill>
              </td>
              <td className="font-numeric text-text px-3 py-2 text-caption">
                {formatDate(g.receivedAt)}
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
