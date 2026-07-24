'use client';

import type { RenewalAlertAction } from '@/lib/shared';
import { Pill } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  useAcknowledgeAlert,
  useRenewalCalendar,
  useRenewContract,
} from '@/lib/api/contracts';
import { inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

const BUCKETS: { key: string; label: string; variant: 'danger' | 'warn' | 'info' }[] = [
  { key: '30d', label: 'Within 30 days', variant: 'danger' },
  { key: '60d', label: 'Within 60 days', variant: 'warn' },
  { key: '90d', label: 'Within 90 days', variant: 'info' },
  { key: 'expired', label: 'Expired', variant: 'danger' },
];

export default function RenewalsPage(): React.JSX.Element {
  const { data } = useRenewalCalendar();
  const ack = useAcknowledgeAlert();
  const push = useToastStore((s) => s.push);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/contracts"
        className="text-muted hover:text-text mb-3 inline-flex items-center gap-1 text-[13px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Contracts
      </Link>
      <h1 className="tracking-heading text-ink mb-1 text-[20px] font-semibold">
        Renewal calendar
      </h1>
      <p className="text-muted mb-5 text-[13px]">
        Proactive expiry warnings — acknowledge and renew before contracts lapse.
      </p>

      {!data || data.entries.length === 0 ? (
        <p className="text-muted py-16 text-center text-[13px]">
          No contracts expiring within 90 days.
        </p>
      ) : (
        <div className="space-y-5">
          {BUCKETS.map((b) => {
            const rows = data.entries.filter((e) => e.bucket === b.key);
            if (rows.length === 0) return null;
            return (
              <div key={b.key}>
                <div className="mb-2 flex items-center gap-2">
                  <Pill variant={b.variant} dot>
                    {b.label}
                  </Pill>
                  <span className="text-muted text-[12px]">{rows.length}</span>
                </div>
                <div className="border-line divide-line divide-y rounded-lg border">
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
                          push(`Acknowledged — ${action}`, 'success');
                        } catch (err) {
                          push(err instanceof Error ? err.message : 'Failed', 'error');
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RenewalRow({
  entry,
  onAck,
}: {
  entry: import('@/lib/shared').RenewalCalendarEntry;
  onAck: (a: RenewalAlertAction) => Promise<void>;
}): React.JSX.Element {
  const router = useRouter();
  const renew = useRenewContract(entry.contractId);
  const push = useToastStore((s) => s.push);
  return (
    <div className="flex items-center justify-between px-4 py-3 text-[13px]">
      <div>
        <Link
          href={`/contracts/${entry.contractId}`}
          className="text-accent-2 font-numeric font-medium"
        >
          {entry.number}
        </Link>
        <span className="text-ink ml-2">{entry.title}</span>
        <span className="text-muted ml-2">· {entry.vendorName}</span>
        <div className="text-muted text-[12px]">
          {inr(entry.totalValueEstimate)} ·{' '}
          {entry.daysToExpiry >= 0 ? `${entry.daysToExpiry} days left` : 'expired'}
          {entry.alert?.acknowledgedAt && (
            <span className="text-accent-2">
              {' '}
              · acknowledged ({entry.alert.actionTaken})
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onAck('UNDER_NEGOTIATION')}
          className="border-line text-text hover:bg-canvas rounded-md border px-3 py-1.5 text-[12px]"
        >
          Acknowledge
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              const r = await renew.mutateAsync({});
              push('Renewal draft created', 'success');
              router.push(`/contracts/${r.id}`);
            } catch (e) {
              push(e instanceof Error ? e.message : 'Renew failed', 'error');
            }
          }}
          className="bg-ink rounded-md px-3 py-1.5 text-[12px] font-medium text-white"
        >
          Renew
        </button>
      </div>
    </div>
  );
}
