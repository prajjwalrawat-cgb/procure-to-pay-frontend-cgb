'use client';

import {
  Badge,
  Button,
  PageHeader,
  StatusText,
  SubNav,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableState,
} from '@/components/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { usePurchaseOrders, type PoTab } from '@/lib/api/purchase-orders';
import { formatDate, inr, statusLabel, statusVariant } from '@/lib/format';

const TABS: { key: PoTab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'partial', label: 'Partial' },
  { key: 'awaiting_grn', label: 'Awaiting GRN' },
  { key: 'closed', label: 'Closed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function PurchaseOrdersPage(): React.JSX.Element {
  const [tab, setTab] = useState<PoTab>('open');
  const { data, isLoading, error, refetch } = usePurchaseOrders(tab);
  const counts = data?.counts;

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        description="Issued and in-flight orders."
        actions={
          // Spot buy — no requisition behind it; see /purchase-orders/new.
          <Link href="/purchase-orders/new">
            <Button variant="primary" size="sm">
              <Plus className="h-3.5 w-3.5" /> New PO
            </Button>
          </Link>
        }
      />

      <SubNav
        className="mb-3"
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: counts?.[t.key] ?? 0,
        }))}
        value={tab}
        onChange={(k) => setTab(k as PoTab)}
      />

      <Table>
        <TableHeader>
          <tr>
            <TableHead>PO</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Cost centre</TableHead>
            <TableHead numeric>Received</TableHead>
            <TableHead numeric>Expected</TableHead>
            <TableHead numeric>Value</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          <TableState
            colSpan={7}
            isLoading={isLoading}
            error={error}
            isEmpty={(data?.items.length ?? 0) === 0}
            onRetry={() => void refetch()}
            empty={{
              title: 'No purchase orders in this view',
              detail:
                tab === 'open'
                  ? 'Approved requisitions become orders here, along with any spot buys you raise directly.'
                  : 'Orders reach this view as they move through their lifecycle.',
              action:
                tab === 'open' ? (
                  <Link href="/purchase-orders/new">
                    <Button variant="primary" size="sm">
                      <Plus className="h-3.5 w-3.5" /> New PO
                    </Button>
                  </Link>
                ) : undefined,
            }}
          />
          {data?.items.map((po) => (
            <TableRow key={po.id}>
              <TableCell>
                <Link
                  href={`/purchase-orders/${po.id}`}
                  className="font-numeric text-ink font-medium hover:underline"
                >
                  {po.number}
                </Link>
                <div className="mt-0.5">
                  <StatusText variant={statusVariant(po.status)}>
                    {statusLabel(po.status)}
                  </StatusText>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-text">{po.vendor.name}</span>
                {po.vendor.isMsme && (
                  <Badge variant="classification" className="ml-1.5">
                    MSME
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-muted text-[12px]">{po.description}</TableCell>
              <TableCell className="text-muted text-[12px]">
                {po.costCenter ? po.costCenter.code : '—'}
              </TableCell>
              <TableCell numeric>
                <Fulfilment pct={po.fulfilmentPct} />
              </TableCell>
              <TableCell numeric className="text-text text-[12px]">
                {formatDate(po.expectedDeliveryDate)}
              </TableCell>
              <TableCell numeric className="text-ink font-medium">
                {inr(po.totalAmount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Fulfilment against the order, as a figure.
 *
 * This started as a progress bar and was wrong twice over. An empty track at 0%
 * is ambiguous — it reads as "no data" as easily as "nothing has arrived" —
 * and spelling that out in words instead put the same sentence on all sixteen
 * rows, which is a column of noise you learn to skip.
 *
 * A percentage in the numeric column solves both: 0% is unambiguous, the
 * figures align down the page, and the eye can find the one order that is
 * part-received without reading anything. Only 100% takes colour, because
 * "done" is the state you scan for; everything short of it is just progress.
 */
function Fulfilment({ pct }: { pct: number }): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <span className={clamped >= 100 ? 'text-success font-medium' : 'text-muted'}>
      {clamped.toFixed(0)}%
    </span>
  );
}
