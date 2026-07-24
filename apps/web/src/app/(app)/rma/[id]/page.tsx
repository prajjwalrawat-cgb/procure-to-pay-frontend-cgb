'use client';

import { openAuthedAsset } from '@/lib/api-client';
import { Button, Pill } from '@procureflow/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  useCloseRma,
  useIssueRma,
  useRecordCreditNote,
  useRecordRmaPickup,
  useRma,
  useUpdateRma,
} from '@/lib/api/rma';
import { inr, statusLabel, statusVariant } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

export default function RmaDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const push = useToastStore((s) => s.push);
  const { data, isLoading } = useRma(id);
  const update = useUpdateRma(id);
  const issue = useIssueRma(id);
  const pickup = useRecordRmaPickup(id);
  const creditNote = useRecordCreditNote(id);
  const close = useCloseRma(id);

  const [notes, setNotes] = useState('');

  if (isLoading || !data) {
    return <div className="text-muted mx-auto max-w-4xl px-4 py-10">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="tracking-heading font-numeric text-ink text-[20px] font-semibold">
              {data.number}
            </h1>
            <Pill variant={statusVariant(data.status)} dot>
              {statusLabel(data.status)}
            </Pill>
          </div>
          <p className="text-muted text-[13px]">
            {data.vendor.name} · GRN{' '}
            <Link
              href={`/goods-receipt/${data.grn.id}`}
              className="text-accent-2 hover:underline"
            >
              {data.grn.number}
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          {data.pdfAvailable && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                openAuthedAsset(`/rma/${id}/pdf`).catch((e) =>
                  push((e as Error).message, 'error'),
                )
              }
            >
              Download PDF
            </Button>
          )}
          {data.canIssue && (
            <Button
              size="sm"
              variant="accent"
              disabled={issue.isPending}
              onClick={() =>
                issue.mutate(undefined as void, {
                  onSuccess: () => push('RMA issued', 'success'),
                  onError: (e) => push((e as Error).message, 'error'),
                })
              }
            >
              Issue RMA
            </Button>
          )}
          {data.canRecordPickup && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const vehicle = window.prompt('Vehicle out no?');
                const gate = vehicle && window.prompt('Gate-pass out no?');
                if (vehicle && gate)
                  pickup.mutate(
                    { vehicleOutNo: vehicle, gatePassOutNo: gate },
                    {
                      onSuccess: () => push('Pickup recorded', 'success'),
                      onError: (e) => push((e as Error).message, 'error'),
                    },
                  );
              }}
            >
              Record pickup
            </Button>
          )}
          {data.canRecordCreditNote && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const ref = window.prompt('Credit note ref?');
                const amount = ref && window.prompt('Credit note amount?');
                if (ref && amount)
                  creditNote.mutate(
                    { creditNoteRef: ref, creditNoteAmount: amount },
                    {
                      onSuccess: () => push('Credit note recorded', 'success'),
                      onError: (e) => push((e as Error).message, 'error'),
                    },
                  );
              }}
            >
              Record credit note
            </Button>
          )}
          {data.canClose && (
            <Button
              size="sm"
              variant="default"
              onClick={() =>
                close.mutate(undefined as void, {
                  onSuccess: () => push('RMA closed', 'success'),
                  onError: (e) => push((e as Error).message, 'error'),
                })
              }
            >
              Close RMA
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <div className="border-line bg-panel rounded-lg border p-4">
            <h2 className="text-faint mb-2 text-[11px] font-medium uppercase">
              Return lines
            </h2>
            <table className="w-full text-[12px]">
              <thead className="text-faint text-left text-[10px] uppercase">
                <tr>
                  <th className="py-1">Item</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1 text-right">Rate</th>
                  <th className="py-1 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.id} className="border-line border-t">
                    <td className="text-text py-1.5">{l.itemDesc}</td>
                    <td className="font-numeric py-1.5 text-right">
                      {l.qtyReturned} {l.uom}
                    </td>
                    <td className="font-numeric py-1.5 text-right">{inr(l.unitPrice)}</td>
                    <td className="font-numeric py-1.5 text-right">{inr(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.canEdit && (
            <div className="border-line bg-panel rounded-lg border p-4">
              <h2 className="text-faint mb-2 text-[11px] font-medium uppercase">
                Refine reason
              </h2>
              <textarea
                className="border-line bg-panel focus-visible:ring-accent w-full rounded-sm border px-3 py-2 text-[13px] outline-none focus-visible:ring-2"
                rows={3}
                placeholder={data.reasonNotes ?? 'Add return reason detail…'}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="default"
                  disabled={!notes || update.isPending}
                  onClick={() =>
                    update.mutate(
                      { reasonNotes: notes },
                      {
                        onSuccess: () => push('Reason updated', 'success'),
                        onError: (e) => push((e as Error).message, 'error'),
                      },
                    )
                  }
                >
                  Save reason
                </Button>
              </div>
            </div>
          )}

          <div className="border-line bg-panel rounded-lg border p-4">
            <h2 className="text-faint mb-2 text-[11px] font-medium uppercase">
              Activity
            </h2>
            <ul className="space-y-1 text-[12px]">
              {data.activity.map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span className="text-text">{a.action}</span>
                  <span className="text-faint font-numeric">
                    {new Date(a.at).toLocaleString('en-IN')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border-line bg-panel rounded-lg border p-4 text-[12px]">
            <h2 className="text-faint mb-2 text-[11px] font-medium uppercase">Summary</h2>
            <Row k="Reason" v={data.reasonCode} />
            <Row k="Freight" v={data.returnFreightBorneBy} />
            <Row k="Vehicle out" v={data.vehicleOutNo ?? '—'} />
            <Row k="Gate-pass out" v={data.gatePassOutNo ?? '—'} />
            <Row k="Credit note" v={data.creditNoteRef ?? '—'} />
            <Row
              k="Credit amount"
              v={data.creditNoteAmount ? inr(data.creditNoteAmount) : '—'}
            />
            <div className="border-line mt-2 border-t pt-2">
              <Row k="Total return" v={inr(data.totalReturnValue)} bold />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  bold,
}: {
  k: string;
  v: string;
  bold?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted">{k}</span>
      <span className={'font-numeric ' + (bold ? 'text-ink font-semibold' : 'text-text')}>
        {v}
      </span>
    </div>
  );
}
