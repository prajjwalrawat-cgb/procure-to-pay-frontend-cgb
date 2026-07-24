'use client';

import { openAuthedAsset } from '@/lib/api-client';
import { Button, Pill } from '@procureflow/ui';
import { Money } from '@procureflow/shared';

import { useScheduleRmaPickup, useVendorRmas } from '@/lib/api/receipts';

function inr(v: string): string {
  return Money.of(v).toINR();
}

export default function VendorRmaPage(): React.JSX.Element {
  const { data, isLoading } = useVendorRmas();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-ink mb-1 text-[20px] font-semibold">Return authorisations</h1>
      <p className="text-muted mb-4 text-[13px]">
        Material returns requested against your deliveries
      </p>

      <div className="space-y-3">
        {isLoading && <p className="text-muted text-[13px]">Loading…</p>}
        {!isLoading && (data?.items.length ?? 0) === 0 && (
          <p className="text-muted text-[13px]">No active returns.</p>
        )}
        {data?.items.map((r) => (
          <RmaCard key={r.id} rma={r} />
        ))}
      </div>
    </div>
  );
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

  return (
    <div className="border-line bg-panel rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-numeric text-ink text-[14px] font-medium">
            {rma.number}
          </span>
          <span className="ml-2">
            <Pill variant="gray">{rma.status}</Pill>
          </span>
          <p className="text-muted mt-1 text-[12px]">
            {rma.reasonCode} · {inr(rma.totalReturnValue)}
          </p>
          {rma.pickupScheduledAt && (
            <p className="text-faint font-numeric text-[11px]">
              Pickup {new Date(rma.pickupScheduledAt).toLocaleString('en-IN')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {rma.pdfAvailable && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void openAuthedAsset(`/vendor/rma/${rma.id}/pdf`);
              }}
            >
              Download PDF
            </Button>
          )}
          {rma.status === 'ISSUED' && (
            <Button
              size="sm"
              variant="accent"
              disabled={schedule.isPending}
              onClick={() => {
                const date = window.prompt('Pickup date (YYYY-MM-DD)?');
                if (date)
                  schedule.mutate(new Date(`${date}T10:00:00.000Z`).toISOString());
              }}
            >
              Schedule pickup
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
