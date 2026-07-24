'use client';

import type { InboxItem } from '@procureflow/shared';
import { Button, Pill } from '@procureflow/ui';
import Link from 'next/link';
import { useState } from 'react';

import { useBulkApprove, useInbox, type InboxFilterKey } from '@/lib/api/inbox';
import { inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

const FILTERS: { key: InboxFilterKey; label: string }[] = [
  { key: 'waiting_on_me', label: 'Waiting on me' },
  { key: 'all', label: 'All' },
  { key: 'delegated_to_me', label: 'Delegated to me' },
  { key: 'delegated_by_me', label: 'Delegated by me' },
];

const SLA_VARIANT = { ok: 'success', warn: 'warn', breach: 'danger' } as const;

export default function InboxPage(): React.JSX.Element {
  const [filter, setFilter] = useState<InboxFilterKey>('waiting_on_me');
  const { data, isLoading } = useInbox(filter);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const bulk = useBulkApprove();
  const toast = useToastStore((s) => s.push);

  const items = data?.items ?? [];
  const toggle = (id: string): void =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const doBulk = (): void => {
    bulk.mutate(
      { approvalIds: [...selected] },
      {
        onSuccess: (r) => {
          toast(`Approved ${r.approved} document(s)`, 'success');
          setSelected(new Set());
          setConfirming(false);
        },
        onError: (e) => toast((e as Error).message, 'error'),
      },
    );
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            My approvals
          </h1>
          <p className="text-muted text-[13px]">
            Documents routed to you for a decision.
          </p>
        </div>
        {selected.size > 0 && (
          <Button variant="accent" size="sm" onClick={() => setConfirming(true)}>
            Approve selected ({selected.size})
          </Button>
        )}
      </div>

      <div className="border-line mb-4 flex items-center gap-1 border-b">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={
              'border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ' +
              (filter === f.key
                ? 'border-accent text-ink'
                : 'text-muted border-transparent')
            }
          >
            {f.label}
            {f.key === 'waiting_on_me' && data?.counts.waiting_on_me
              ? ` (${data.counts.waiting_on_me})`
              : ''}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-muted text-[13px]">Loading…</div>}

      <div className="border-line bg-panel overflow-hidden rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="border-line text-faint border-b text-[11px] uppercase tracking-wide">
            <tr>
              <th className="w-8 p-2"></th>
              <th className="p-2 text-left">Document</th>
              <th className="p-2 text-left">Submitter</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-right">Pending</th>
              <th className="p-2 text-left">SLA</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: InboxItem) => (
              <tr key={item.approvalId} className="border-line border-b last:border-0">
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={selected.has(item.approvalId)}
                    onChange={() => toggle(item.approvalId)}
                  />
                </td>
                <td className="p-2">
                  <Link href={item.href} className="text-ink font-numeric font-medium">
                    {item.number}
                  </Link>
                  <span className="text-faint ml-1 text-[11px]">{item.documentType}</span>
                  {item.delegatedFromName && (
                    <span className="text-violet ml-1 text-[11px]">
                      · via {item.delegatedFromName}
                    </span>
                  )}
                </td>
                <td className="text-muted p-2">{item.submitterName ?? '—'}</td>
                <td className="font-numeric p-2 text-right">
                  {item.amount ? inr(item.amount) : '—'}
                </td>
                <td className="font-numeric p-2 text-right">{item.daysPending}d</td>
                <td className="p-2">
                  <Pill variant={SLA_VARIANT[item.slaStatus]} dot>
                    {item.slaStatus}
                  </Pill>
                </td>
                <td className="p-2 text-right">
                  <Link href={item.href} className="text-accent-2 text-[12px]">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className="text-muted p-6 text-center text-[13px]">
                  Nothing waiting on you.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="bg-panel border-line w-full max-w-md rounded-xl border p-5 shadow-lg">
            <h3 className="text-ink text-[15px] font-semibold">
              Approve {selected.size} document(s)?
            </h3>
            <p className="text-muted mt-2 text-[13px]">
              Each will advance to the next step or be marked approved.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                variant="accent"
                size="sm"
                disabled={bulk.isPending}
                onClick={doBulk}
              >
                Approve all
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
