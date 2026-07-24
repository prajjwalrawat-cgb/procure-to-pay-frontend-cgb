'use client';

import { Button, Pill } from '@procureflow/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import {
  usePostReceipt,
  useReceipt,
  useReverseReceipt,
  useSubmitReceipt,
} from '@/lib/api/receipts';
import { inr, statusLabel, statusVariant } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

export default function ReceiptDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const push = useToastStore((s) => s.push);
  const { data, isLoading } = useReceipt(id);
  const submit = useSubmitReceipt(id);
  const post = usePostReceipt(id);
  const reverse = useReverseReceipt(id);

  if (isLoading || !data) {
    return <div className="text-muted mx-auto max-w-5xl px-4 py-10">Loading…</div>;
  }

  const act = (fn: { mutate: (v: void, o: object) => void }, ok: string): void =>
    fn.mutate(undefined as void, {
      onSuccess: () => push(ok, 'success'),
      onError: (e: unknown) => push((e as Error).message, 'error'),
    });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="tracking-heading font-numeric text-ink text-[20px] font-semibold">
              {data.number}
            </h1>
            <Pill variant={statusVariant(data.status)} dot>
              {statusLabel(data.status)}
            </Pill>
            <Pill variant={statusVariant(data.qcStatus)}>
              QC · {statusLabel(data.qcStatus)}
            </Pill>
          </div>
          <p className="text-muted text-[13px]">
            {data.vendor.name} · PO{' '}
            <Link
              href={`/purchase-orders/${data.po.id}`}
              className="text-accent-2 hover:underline"
            >
              {data.po.number}
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          {data.canStartQc || data.status === 'DRAFT' ? (
            data.status === 'DRAFT' ? (
              <Button
                size="sm"
                variant="accent"
                disabled={submit.isPending}
                onClick={() => act(submit, 'Sent for QC')}
              >
                Send for QC
              </Button>
            ) : (
              <Link href={`/goods-receipt/${id}/qc`}>
                <Button size="sm" variant="accent">
                  Start QC
                </Button>
              </Link>
            )
          ) : null}
          {data.canCompleteQc && (
            <Link href={`/goods-receipt/${id}/qc`}>
              <Button size="sm" variant="accent">
                Continue QC
              </Button>
            </Link>
          )}
          {data.canPost && (
            <Button
              size="sm"
              variant="primary"
              disabled={post.isPending}
              onClick={() => act(post, 'Receipt posted')}
            >
              Post GRN
            </Button>
          )}
          {data.canReverse && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                const reason = window.prompt('Reversal reason?');
                if (reason)
                  reverse.mutate(reason, {
                    onSuccess: () => push('Receipt reversed', 'success'),
                    onError: (e) => push((e as Error).message, 'error'),
                  });
              }}
            >
              Reverse
            </Button>
          )}
        </div>
      </div>

      {/* Stage strip */}
      <div className="mb-4 flex gap-1">
        {data.stages.map((s) => (
          <div
            key={s.key}
            className={
              'flex-1 rounded-sm px-2 py-1.5 text-center text-[11px] font-medium ' +
              (s.state === 'done'
                ? 'bg-accent-wash text-accent-2'
                : s.state === 'active'
                  ? 'bg-ink text-white'
                  : 'bg-canvas text-faint')
            }
          >
            {s.label}
          </div>
        ))}
      </div>

      {data.varianceFlags.length > 0 && (
        <div className="bg-warn-wash text-warn mb-4 rounded-sm px-3 py-2 text-[12px]">
          Flags: {data.varianceFlags.join(', ')}
          {data.requiresPlantHeadSignoff && ' · plant-head sign-off required to post'}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* Gate details */}
          <Card title="Gate details">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
              <Def k="Gate entry" v={data.gate.gateEntryRef} />
              <Def k="Vehicle" v={data.gate.vehicleNo} />
              <Def k="Driver" v={data.gate.driverName} />
              <Def k="Transporter" v={data.gate.transporter} />
              <Def k="E-way bill" v={data.gate.ewayBillNo} />
              <Def k="Packing" v={data.gate.packingCondition} />
              <Def k="Unloading" v={data.gate.unloadingLocation} />
              <Def
                k="Weighbridge net"
                v={data.gate.netWeightKg ? `${data.gate.netWeightKg} kg` : null}
              />
            </dl>
          </Card>

          {/* Lines */}
          <Card title="Line items">
            <table className="w-full text-[12px]">
              <thead className="text-faint text-left text-[10px] uppercase">
                <tr>
                  <th className="py-1">Item</th>
                  <th className="py-1 text-right">Received</th>
                  <th className="py-1 text-right">Accepted</th>
                  <th className="py-1 text-right">Rejected</th>
                  <th className="py-1">Batch</th>
                  <th className="py-1 text-right">Landed</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.id} className="border-line border-t">
                    <td className="text-text py-1.5">{l.itemDesc}</td>
                    <td className="font-numeric py-1.5 text-right">
                      {l.qtyReceived} {l.uom}
                    </td>
                    <td className="font-numeric text-accent-2 py-1.5 text-right">
                      {l.qtyAccepted}
                    </td>
                    <td className="font-numeric text-danger py-1.5 text-right">
                      {Number(l.qtyRejected) > 0 ? l.qtyRejected : '—'}
                    </td>
                    <td className="text-faint font-numeric py-1.5">
                      {l.batchNumber ?? '—'}
                    </td>
                    <td className="font-numeric py-1.5 text-right">
                      {inr(l.unitLandedCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* QC samples */}
          {data.lines.some((l) => l.qcSamples.length > 0) && (
            <Card title="QC samples">
              {data.lines.flatMap((l) =>
                l.qcSamples.map((s) => (
                  <div key={s.id} className="border-line border-t py-2 first:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-text text-[12px]">
                        {l.itemDesc} · sample {s.sampleSize}
                      </span>
                      <Pill variant={statusVariant(s.result)}>
                        {statusLabel(s.result)}
                      </Pill>
                    </div>
                    <div className="text-faint mt-1 flex flex-wrap gap-2 text-[11px]">
                      {s.parameters.map((p) => (
                        <span
                          key={p.parameter}
                          className={
                            p.result === 'PASS' ? 'text-accent-2' : 'text-danger'
                          }
                        >
                          {p.parameter}: {String(p.measured)} ({p.result})
                        </span>
                      ))}
                    </div>
                  </div>
                )),
              )}
            </Card>
          )}

          {/* Activity */}
          <Card title="Activity">
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
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Purchase order">
            <div className="text-[12px]">
              <Link
                href={`/purchase-orders/${data.po.id}`}
                className="font-numeric text-accent-2 hover:underline"
              >
                {data.po.number}
              </Link>
              <p className="text-muted mt-1">
                Fulfilment {data.po.fulfilmentPct.toFixed(0)}%
              </p>
            </div>
          </Card>

          {data.rma && (
            <Card title="Return authorisation">
              <Link
                href={`/rma/${data.rma.id}`}
                className="font-numeric text-accent-2 text-[12px] hover:underline"
              >
                {data.rma.number}
              </Link>
              <div className="mt-1">
                <Pill variant={statusVariant(data.rma.status)}>
                  {statusLabel(data.rma.status)}
                </Pill>
              </div>
            </Card>
          )}

          {data.invoiceLinks.length > 0 && (
            <Card title="Invoice matches">
              {data.invoiceLinks.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-[12px]">
                  <Link
                    href={`/invoices/${i.id}`}
                    className="font-numeric text-accent-2 hover:underline"
                  >
                    {i.number}
                  </Link>
                  <Pill variant={statusVariant(i.status)}>{statusLabel(i.status)}</Pill>
                </div>
              ))}
            </Card>
          )}

          <Card title="Stock impact">
            {data.lines.map((l) => (
              <div key={l.id} className="text-[12px]">
                <span className="text-text">{l.itemDesc}</span>
                <p className="text-faint font-numeric">
                  {l.stockBefore ?? '—'} → {l.stockAfter ?? '—'}
                </p>
              </div>
            ))}
          </Card>

          <Card title="Total">
            <p className="font-numeric text-ink text-[16px] font-semibold">
              {inr(data.totals.value)}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel rounded-lg border p-4">
      <h2 className="text-faint mb-2 text-[11px] font-medium uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Def({ k, v }: { k: string; v: string | null }): React.JSX.Element {
  return (
    <div>
      <dt className="text-faint">{k}</dt>
      <dd className="text-text font-numeric">{v ?? '—'}</dd>
    </div>
  );
}
