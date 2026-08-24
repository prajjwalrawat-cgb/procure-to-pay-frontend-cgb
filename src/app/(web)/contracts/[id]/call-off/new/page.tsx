'use client';

import { PageHeader } from '@/components/ui';

import type { CallOffInput } from '@/lib/shared';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useContract, useCreateCallOff } from '@/lib/api/contracts';
import { inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

export default function NewCallOffPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const push = useToastStore((s) => s.push);
  const { data: c } = useContract(id);
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

  if (!c)
    return (
      <p className="mx-auto max-w-3xl py-10 text-center text-[13px] text-muted">
        Loading…
      </p>
    );

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/contracts/${id}`}
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {c.number}
      </Link>
      <PageHeader
        title="New call-off"
        description="Pricing is locked to the contract rate card — no override possible."
      />

      <div className="space-y-3 rounded-lg border border-line bg-panel p-5">
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted">Rate card row</span>
          <select
            className="w-full rounded-md border border-line px-2.5 py-1.5 text-[13px]"
            value={rateCardId}
            onChange={(e) => setRateCardId(e.target.value)}
          >
            <option value="">Select…</option>
            {c.rateCards.map((r) => (
              <option key={r.id} value={r.id}>
                {r.routeOrigin ? `${r.routeOrigin}→${r.routeDest}` : r.itemDesc} · Yr
                {r.rateYear} · ₹{r.unitRate}/{r.uom}
              </option>
            ))}
          </select>
        </label>

        {card && (
          <p className="text-[12px] text-muted">
            Locked unit price:{' '}
            <span className="font-numeric text-ink">₹{card.unitRate}</span> per {card.uom}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">
              Quantity ({card?.uom ?? 'unit'})
            </span>
            <input
              className="w-full rounded-md border border-line px-2.5 py-1.5 text-[13px]"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Expected delivery</span>
            <input
              type="date"
              className="w-full rounded-md border border-line px-2.5 py-1.5 text-[13px]"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-[12px] text-muted">Delivery location</span>
          <input
            className="w-full rounded-md border border-line px-2.5 py-1.5 text-[13px]"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
          />
        </label>

        {lineValue > 0 && (
          <div className="rounded-md bg-canvas p-3 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted">Call-off value (incl. tax)</span>
              <span className="font-numeric text-ink">{inr(lineValue)}</span>
            </div>
            {projected != null && (
              <p className="mt-1 text-[12px] text-accent-2">
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

        <button
          type="button"
          onClick={submit}
          disabled={callOff.isPending}
          className="w-full rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
        >
          Create call-off PO
        </button>
      </div>
    </div>
  );
}
