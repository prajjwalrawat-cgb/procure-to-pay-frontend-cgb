'use client';

import { openAuthedAsset } from '@/vendor/lib/api-client';
import {
  Button,
  DataState,
  DateInput,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  PageHeader,
  Pill,
  SkeletonCards,
} from '@/components/ui';
import { Money } from '@/lib/shared';
import { useState } from 'react';

import { useScheduleRmaPickup, useVendorRmas } from '@/vendor/lib/api/receipts';
import { useToastStore } from '@/vendor/store/toast-store';
import { formatDateTime, statusLabel, statusVariant } from '@/lib/format';

function inr(v: string): string {
  return Money.of(v).toINR();
}

export default function VendorRmaPage(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useVendorRmas();
  const empty = !isLoading && !error && (data?.items.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Return authorisations"
        description="Material the buyer is returning against your deliveries."
      />

      {/* Return cards are panels; the empty state gets the same frame. */}
      <div className={empty ? 'border-line bg-panel rounded-lg border' : undefined}>
        <DataState
          isLoading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          isEmpty={(data?.items.length ?? 0) === 0}
          loading={<SkeletonCards count={3} className="sm:grid-cols-1 xl:grid-cols-1" />}
          empty={{
            title: 'No active returns',
            detail: 'If the buyer rejects material at quality check, the return authorisation appears here for you to schedule a pickup.',
          }}
        >
          <div className="space-y-3">
            {data?.items.map((r) => (
              <RmaCard key={r.id} rma={r} />
            ))}
          </div>
        </DataState>
      </div>
    </div>
  );
}

/** Tomorrow as yyyy-mm-dd — the earliest a pickup can sensibly be booked. */
function tomorrow(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function RmaCard({
  rma,
}: {
  rma: {
    id: string;
    number: string;
    status: string;
    reasonCode: string;
    totalReturnValue: string;
    pickupScheduledAt: string | null;
    pdfAvailable: boolean;
  };
}): React.JSX.Element {
  const schedule = useScheduleRmaPickup(rma.id);
  const toast = useToastStore((s) => s.push);
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState(tomorrow);

  const onSchedule = (): void =>
    schedule.mutate(new Date(`${date}T10:00:00.000Z`).toISOString(), {
      onSuccess: () => {
        setPicking(false);
        toast('Pickup scheduled', 'success');
      },
      onError: (e) => toast(e instanceof Error ? e.message : 'Could not schedule', 'error'),
    });

  return (
    <div className="border-line bg-panel rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-numeric text-ink text-body font-medium">{rma.number}</span>
            <Pill variant={statusVariant(rma.status)} dot>
              {statusLabel(rma.status)}
            </Pill>
          </div>
          <p className="text-muted mt-1 text-caption">
            {statusLabel(rma.reasonCode)} · {inr(rma.totalReturnValue)}
          </p>
          {rma.pickupScheduledAt && (
            <p className="font-numeric text-faint text-micro">
              Pickup {formatDateTime(rma.pickupScheduledAt)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {rma.pdfAvailable && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void openAuthedAsset(`/vendor/rma/${rma.id}/pdf`);
              }}
            >
              Download PDF
            </Button>
          )}
          {rma.status === 'ISSUED' && (
            <Button size="sm" variant="primary" onClick={() => setPicking(true)}>
              Schedule pickup
            </Button>
          )}
        </div>
      </div>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent>
          <DialogTitle>Schedule pickup for {rma.number}</DialogTitle>
          <DialogDescription>
            Pick the day you will collect the returned material. The buyer&rsquo;s stores
            team is notified.
          </DialogDescription>
          <Field label="Pickup date" htmlFor={`pickup-${rma.id}`} className="mt-4">
            <DateInput
              id={`pickup-${rma.id}`}
              value={date}
              min={tomorrow()}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!date || schedule.isPending}
              onClick={onSchedule}
            >
              {schedule.isPending ? 'Scheduling…' : 'Schedule pickup'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
