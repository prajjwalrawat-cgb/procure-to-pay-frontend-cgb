'use client';

import type { RenewalAlertAction, RenewalCalendarEntry } from '@/lib/shared';
import { Button, DataState, PageHeader, Pill } from '@/components/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  useAcknowledgeAlert,
  useRenewalCalendar,
  useRenewContract,
} from '@/lib/api/contracts';
import { humanise, inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

const BUCKETS: { key: string; label: string; variant: 'danger' | 'warn' | 'info' }[] = [
  { key: 'expired', label: 'Expired', variant: 'danger' },
  { key: '30d', label: 'Within 30 days', variant: 'danger' },
  { key: '60d', label: 'Within 60 days', variant: 'warn' },
  { key: '90d', label: 'Within 90 days', variant: 'info' },
];

export default function RenewalsPage(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useRenewalCalendar();
  const ack = useAcknowledgeAlert();
  const push = useToastStore((s) => s.push);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Contracts', href: '/contracts' }, { label: 'Renewals' }]}
        title="Renewal calendar"
        description="Proactive expiry warnings — acknowledge and renew before contracts lapse."
      />

      <DataState
        isLoading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        isEmpty={!data || data.entries.length === 0}
        empty={{
          title: 'Nothing up for renewal',
          detail: 'No contracts expire within the next 90 days.',
        }}
      >
        <div className="flex flex-col gap-6">
          {BUCKETS.map((b) => {
            const rows = (data?.entries ?? []).filter((e) => e.bucket === b.key);
            if (rows.length === 0) return null;
            return (
              <section key={b.key}>
                <div className="mb-2 flex items-center gap-2">
                  <Pill variant={b.variant} dot>
                    {b.label}
                  </Pill>
                  <span className="font-numeric text-caption text-muted">{rows.length}</span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-line bg-panel">
                  <table className="pf-stack w-full text-body-sm">
                    <thead className="border-b border-line text-left text-caption text-muted">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Contract</th>
                        <th className="px-3 py-2.5 font-medium">Vendor</th>
                        <th className="px-3 py-2.5 text-right font-medium">Value</th>
                        <th className="px-3 py-2.5 font-medium">Expiry</th>
                        <th className="px-3 py-2.5 font-medium">Alert</th>
                        <th className="px-3 py-2.5 text-right font-medium">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((e) => (
                        <RenewalRow
                          key={e.contractId}
                          entry={e}
                          onAck={async (action) => {
                            if (!e.alert) {
                              push('No active alert to acknowledge', 'info');
                              return;
                            }
                            try {
                              await ack.mutateAsync({
                                alertId: e.alert.id,
                                body: { actionTaken: action },
                              });
                              push(`Acknowledged — ${humanise(action).toLowerCase()}`, 'success');
                            } catch (err) {
                              push(err instanceof Error ? err.message : 'Failed', 'error');
                            }
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      </DataState>
    </div>
  );
}

function RenewalRow({
  entry,
  onAck,
}: {
  entry: RenewalCalendarEntry;
  onAck: (a: RenewalAlertAction) => Promise<void>;
}): React.JSX.Element {
  const router = useRouter();
  const renew = useRenewContract(entry.contractId);
  const push = useToastStore((s) => s.push);
  return (
    <tr className="border-t border-line">
      <td className="px-3 py-3.5">
        <Link
          href={`/contracts/${entry.contractId}`}
          className="font-numeric font-medium text-accent hover:underline"
        >
          {entry.number}
        </Link>
        <div className="text-caption text-muted">{entry.title}</div>
      </td>
      <td className="px-3 py-3.5 text-text">{entry.vendorName}</td>
      <td className="font-numeric px-3 py-3.5 text-right">{inr(entry.totalValueEstimate)}</td>
      <td className="px-3 py-3.5">
        <span className={entry.daysToExpiry < 0 ? 'text-danger' : 'text-text'}>
          {entry.daysToExpiry >= 0 ? `${entry.daysToExpiry} days left` : 'Expired'}
        </span>
      </td>
      <td className="px-3 py-3.5">
        {entry.alert?.acknowledgedAt ? (
          <Pill variant="success" dot>
            Acknowledged
            {entry.alert.actionTaken ? `, ${humanise(entry.alert.actionTaken).toLowerCase()}` : ''}
          </Pill>
        ) : entry.alert ? (
          <Pill variant="warn" dot>
            Open
          </Pill>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className="px-3 py-3.5 text-right">
        <div className="flex flex-wrap justify-end gap-1.5">
          {entry.alert && !entry.alert.acknowledgedAt && (
            <Button variant="ghost" size="sm" onClick={() => void onAck('UNDER_NEGOTIATION')}>
              Acknowledge
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={renew.isPending}
            onClick={async () => {
              try {
                const r = await renew.mutateAsync({});
                push('Renewal draft created', 'success');
                router.push(`/contracts/${r.id}`);
              } catch (e) {
                push(e instanceof Error ? e.message : 'Renew failed', 'error');
              }
            }}
          >
            {renew.isPending ? 'Renewing…' : 'Renew'}
          </Button>
        </div>
      </td>
    </tr>
  );
}
