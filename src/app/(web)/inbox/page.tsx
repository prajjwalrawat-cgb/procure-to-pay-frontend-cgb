'use client';

import type { InboxItem } from '@/lib/shared';
import {
  Button,
  PageHeader,
  Pill,
  SubNav,
  TableState,
} from '@/components/ui';
import { CheckCircle2 } from 'lucide-react';
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

/**
 * The SLA state, in words a reviewer can act on.
 *
 * The raw keys were rendered straight into the column — a lowercase "ok" and
 * "breach" beside a document id. "Breach" states a fact about a contract; "3
 * days over" states the thing the reviewer needs to know.
 */
const SLA_LABEL = {
  ok: 'On time',
  warn: 'Due soon',
  breach: 'Overdue',
} as const;

/** `VENDOR_ONBOARDING` → `Vendor onboarding` */
function documentTypeLabel(t: string): string {
  const s = t.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function InboxPage(): React.JSX.Element {
  const [filter, setFilter] = useState<InboxFilterKey>('waiting_on_me');
  const { data, isLoading, error, refetch } = useInbox(filter);
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
    <div>
      <PageHeader
        title="My approvals"
        description="Documents routed to you for a decision."
        actions={
          selected.size > 0 ? (
            // Bulk-approving commits spend across several documents at once.
            <Button variant="primary" size="sm" onClick={() => setConfirming(true)}>
              Approve selected ({selected.size})
            </Button>
          ) : undefined
        }
      />

      <SubNav
        className="mb-4"
        items={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          count:
            f.key === 'waiting_on_me' ? (data?.counts.waiting_on_me ?? undefined) : undefined,
        }))}
        value={filter}
        onChange={(k) => setFilter(k as (typeof FILTERS)[number]['key'])}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-line border-b text-left text-[12px] text-muted">
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
            <TableState
              colSpan={7}
              isLoading={isLoading}
              error={error}
              isEmpty={items.length === 0}
              onRetry={() => void refetch()}
              empty={{
                title:
                  filter === 'waiting_on_me'
                    ? 'Nothing waiting on you'
                    : 'Nothing in this view',
                detail:
                  filter === 'waiting_on_me'
                    ? 'Your approval queue is clear. Documents routed to you will appear here.'
                    : 'Delegated approvals will be listed here.',
                icon: CheckCircle2,
              }}
            />
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
                  {/* The type leads, because a queue of mixed documents is
                      read by kind first. The identifier is often a raw id the
                      server has no friendlier name for, so it goes underneath
                      at meta size rather than standing in as the title. */}
                  <Link href={item.href} className="text-ink font-medium hover:underline">
                    {documentTypeLabel(item.documentType)}
                  </Link>
                  <div className="font-numeric text-faint truncate text-[11px]">
                    {item.number}
                    {item.delegatedFromName ? ` — via ${item.delegatedFromName}` : ''}
                  </div>
                </td>
                <td className="text-muted p-2">{item.submitterName ?? '—'}</td>
                <td className="font-numeric p-2 text-right">
                  {item.amount ? inr(item.amount) : '—'}
                </td>
                <td className="font-numeric p-2 text-right">{item.daysPending}d</td>
                <td className="p-2">
                  <Pill variant={SLA_VARIANT[item.slaStatus]} dot>
                    {SLA_LABEL[item.slaStatus]}
                  </Pill>
                </td>
                <td className="p-2 text-right">
                  <Link href={item.href} className="text-accent-2 text-[12px]">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
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
                variant="primary"
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
