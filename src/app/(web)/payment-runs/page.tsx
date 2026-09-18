'use client';

import {
  Button,
  PageHeader,
  Pill,
  SubNav,
  TableState,
} from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import { usePaymentRuns, type PaymentRunTab } from '@/lib/api/payments';
import { formatDate, inr, statusLabel, statusVariant } from '@/lib/format';

const TABS: { key: PaymentRunTab; label: string; countKey: keyof Counts }[] = [
  { key: 'all', label: 'All', countKey: 'all' },
  { key: 'draft', label: 'Draft', countKey: 'draft' },
  { key: 'awaiting', label: 'Awaiting approval', countKey: 'awaiting' },
  { key: 'submitted', label: 'Submitted', countKey: 'submitted' },
  { key: 'completed', label: 'Completed', countKey: 'completed' },
  { key: 'failed', label: 'Failed', countKey: 'failed' },
];
type Counts = {
  all: number;
  draft: number;
  awaiting: number;
  submitted: number;
  completed: number;
  failed: number;
};

export default function PaymentRunsPage(): React.JSX.Element {
  const [tab, setTab] = useState<PaymentRunTab>('all');
  const { data, isLoading, error, refetch } = usePaymentRuns(tab);
  const counts = data?.counts;

  return (
    <div>
      <PageHeader
        title="Payment runs"
        description="Compose, approve and submit bank files"
        actions={
          <Link href="/payment-runs/new">
            <Button variant="primary" size="sm">
              New payment run
            </Button>
          </Link>
        }
      />

      <SubNav
        className="mb-3"
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: counts?.[t.countKey] ?? 0,
        }))}
        value={tab}
        onChange={(k) => setTab(k as (typeof TABS)[number]['key'])}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-line border-b text-left text-[12px] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Run</th>
              <th className="px-3 py-2 font-medium">Cycle date</th>
              <th className="px-3 py-2 font-medium">Bank</th>
              <th className="px-3 py-2 font-medium">Items</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Composer</th>
              <th className="px-3 py-2 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={7}
              isLoading={isLoading}
              error={error}
              isEmpty={(data?.items.length ?? 0) === 0}
              onRetry={() => void refetch()}
              empty={{
                title: 'No payment runs in this view',
                detail:
                  'A run batches approved invoices into a single bank file for release.',
                action:
                  tab === 'all' || tab === 'draft' ? (
                    <Link href="/payment-runs/new">
                      <Button variant="primary" size="sm">
                        New payment run
                      </Button>
                    </Link>
                  ) : undefined,
              }}
            />
            {data?.items.map((run) => (
              <tr key={run.id} className="border-line hover:bg-canvas/60 border-t">
                <td className="px-3 py-2">
                  <Link
                    href={`/payment-runs/${run.id}`}
                    className="font-numeric text-ink font-medium"
                  >
                    {run.number}
                  </Link>
                </td>
                <td className="font-numeric text-text px-3 py-2">
                  {formatDate(run.cycleDate)}
                </td>
                <td className="text-text px-3 py-2">{run.bankName ?? '—'}</td>
                <td className="font-numeric text-text px-3 py-2">{run.itemCount}</td>
                <td className="px-3 py-2">
                  <Pill variant={statusVariant(run.status)} dot>
                    {statusLabel(run.status)}
                  </Pill>
                </td>
                <td className="text-muted px-3 py-2">{run.composedByName ?? '—'}</td>
                <td className="font-numeric text-ink px-3 py-2 text-right font-medium">
                  {inr(run.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
