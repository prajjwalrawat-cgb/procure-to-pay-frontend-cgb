'use client';

import { Button, ErrorState, PageHeader, Skeleton, controlClass } from '@/components/ui';

import type { CallOffInput } from '@/lib/shared';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useContract, useCreateCallOff } from '@/lib/api/contracts';
import { inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

export default function NewCallOffPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const push = useToastStore((s) => s.push);
  const { data: c, error, refetch } = useContract(id);
  const callOff = useCreateCallOff(id);

  const [rateCardId, setRateCardId] = useState('');
  const [qty, setQty] = useState('');
  const [expected, setExpected] = useState('');
  const [line1, setLine1] = useState('');

  const card = useMemo(
    () => c?.rateCards.find((r) => r.id === rateCardId),
    [c, rateCardId],
  );
  const vt = c?.volumeTracking;
  const projected =
    vt && vt.committedQty && qty
      ? ((Number(vt.actualQty) + Number(qty)) / Number(vt.committedQty)) * 100
      : null;
  const lineValue =
    card && qty ? Number(qty) * Number(card.unitRate) * (1 + Number(card.taxRate)) : 0;

  const submit = async (): Promise<void> => {
    if (!rateCardId || !qty || !expected) {
      push('Pick a rate row, quantity and delivery date', 'error');
      return;
    }
    const body: CallOffInput = {
      deliveryLocation: { line1 },
      expectedDeliveryDate: new Date(`${expected}T00:00:00Z`).toISOString(),
      lines: [{ contractRateCardId: rateCardId, qty }],
    };
    try {
      const res = await callOff.mutateAsync(body);
      push('Call-off PO created', 'success');
      router.push(`/purchase-orders/${res.poId}?callOff=1`);
    } catch (e) {
      push(e instanceof Error ? e.message : 'Call-off failed', 'error');
    }
  };

  if (error)
    return (
      <div className="mx-auto w-full max-w-3xl rounded-lg border border-line bg-panel">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  if (!c)
    return (
      <div aria-busy="true" className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-72 w-full" />
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        breadcrumbs={[
          { label: 'Contracts', href: '/contracts' },
          { label: c.number, href: `/contracts/${id}` },
          { label: 'New call-off' },
        ]}
        title="New call-off"
        description="Pricing is locked to the contract rate card — no override possible."
      />

      <div className="space-y-3 rounded-lg border border-line bg-panel p-4 sm:p-5">
        <label className="block">
          <span className="mb-1 block text-caption font-medium text-text">
            Rate card row
          </span>
          <select
            className={controlClass + ' pr-8'}
            value={rateCardId}
            onChange={(e) => setRateCardId(e.target.value)}
          >
            <option value="">
              {c.rateCards.length ? 'Select…' : 'This contract has no rate rows'}
            </option>
            {c.rateCards.map((r) => (
              <option key={r.id} value={r.id}>
                {r.routeOrigin ? `${r.routeOrigin} → ${r.routeDest}` : r.itemDesc} · year{' '}
                {r.rateYear} · {inr(r.unitRate)}/{r.uom}
              </option>
            ))}
          </select>
        </label>

        {card && (
          <p className="text-caption text-muted">
            Locked unit price:{' '}
            <span className="font-numeric text-ink">{inr(card.unitRate)}</span> per{' '}
            {card.uom}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-caption font-medium text-text">
              Quantity ({card?.uom ?? 'unit'})
            </span>
            <input
              className={controlClass}
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-caption font-medium text-text">
              Expected delivery
            </span>
            <input
              type="date"
              className={controlClass}
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-caption font-medium text-text">
            Delivery location
          </span>
          <input
            className={controlClass}
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
          />
        </label>

        {lineValue > 0 && (
          <div className="rounded-md bg-canvas p-3 text-body-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted">Call-off value (incl. tax)</span>
              <span className="font-numeric text-ink">{inr(lineValue)}</span>
            </div>
            {projected != null && (
              <p
                className={
                  'mt-1 text-caption ' +
                  (projected >= 90
                    ? 'text-success'
                    : projected >= 70
                      ? 'text-warn'
                      : 'text-danger')
                }
              >
                This brings YTD to {Math.round(projected)}% of the annual commitment
                {projected >= 90
                  ? ' — on track.'
                  : projected >= 70
                    ? ' — at risk.'
                    : ' — shortfall.'}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => router.push(`/contracts/${id}`)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={callOff.isPending}>
            {callOff.isPending ? 'Creating…' : 'Create call-off PO'}
          </Button>
        </div>
      </div>
    </div>
  );
}
