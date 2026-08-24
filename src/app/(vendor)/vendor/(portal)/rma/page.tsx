'use client';

import { openAuthedAsset } from '@/vendor/lib/api-client';
import { Button, PageHeader, Pill } from '@/components/ui';
import { Money } from '@/lib/shared';

import { useScheduleRmaPickup, useVendorRmas } from '@/vendor/lib/api/receipts';

function inr(v: string): string {
  return Money.of(v).toINR();
}

export default function VendorRmaPage(): React.JSX.Element {
  const { data, isLoading } = useVendorRmas();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Return authorisations"
        description="Material returns requested against your deliveries"
      />

      <div className="space-y-3">
        {isLoading && <p className="text-[13px] text-muted">Loading…</p>}
        {!isLoading && (data?.items.length ?? 0) === 0 && (
          <p className="text-[13px] text-muted">No active returns.</p>
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
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-numeric text-[14px] font-medium text-ink">
            {rma.number}
          </span>
          <span className="ml-2">
            <Pill variant="gray">{rma.status}</Pill>
          </span>
          <p className="mt-1 text-[12px] text-muted">
            {rma.reasonCode} · {inr(rma.totalReturnValue)}
          </p>
          {rma.pickupScheduledAt && (
            <p className="font-numeric text-[11px] text-faint">
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
