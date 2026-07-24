'use client';

import { Button, Pill } from '@procureflow/ui';
import Link from 'next/link';
import { useState } from 'react';

import { usePaymentRuns, type PaymentRunTab } from '@/lib/api/payments';
import { inr, statusLabel, statusVariant } from '@/lib/format';

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
  const { data, isLoading } = usePaymentRuns(tab);
  const counts = data?.counts;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            Payment runs
          </h1>
          <p className="text-muted text-[13px]">
            Compose, approve and submit bank files · Star Cement Ltd
          </p>
        </div>
        <Link href="/payment-runs/new">
          <Button variant="primary" size="sm">
            New payment run
          </Button>
        </Link>
      </div>

      <div className="border-line mb-3 flex items-center gap-1 border-b">
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
              {counts?.[t.countKey] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="border-line bg-panel overflow-hidden rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
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
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-muted px-3 py-8 text-center">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (data?.items.length ?? 0) === 0 && (
              <tr>
                <td colSpan={7} className="text-muted px-3 py-8 text-center">
                  No payment runs in this view.
                </td>
              </tr>
            )}
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
                  {new Date(run.cycleDate).toLocaleDateString('en-IN')}
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
