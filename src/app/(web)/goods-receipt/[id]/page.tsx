'use client';

import { History } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Pill,
  Skeleton,
  StageStrip,
  Textarea,
} from '@/components/ui';

import { DocumentLedger } from '@/components/document-ledger';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import {
  usePostReceipt,
  useReceipt,
  useReverseReceipt,
  useSubmitReceipt,
} from '@/lib/api/receipts';
import {
  formatDateTime,
  humanise,
  inr,
  qty,
  statusLabel,
  statusVariant,
} from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

export default function ReceiptDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const push = useToastStore((s) => s.push);
  const { data, isLoading, error, refetch } = useReceipt(id);
  const submit = useSubmitReceipt(id);
  const post = usePostReceipt(id);
  const reverse = useReverseReceipt(id);
  const [reversing, setReversing] = useState(false);

  if (error) {
    return (
      <div className="rounded-lg border border-line bg-panel">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div aria-busy="true" aria-live="polite" className="flex flex-col gap-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  const act = (fn: { mutate: (v: void, o: object) => void }, ok: string): void =>
    fn.mutate(undefined as void, {
      onSuccess: () => push(ok, 'success'),
      onError: (e: unknown) => push((e as Error).message, 'error'),
    });

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Goods receipts', href: '/goods-receipt' },
          { label: data.number },
        ]}
        title={data.number}
        numeric
        meta={
          <>
            <Pill variant={statusVariant(data.status)} dot>
              {statusLabel(data.status)}
            </Pill>
            <Pill variant={statusVariant(data.qcStatus)}>
              QC {statusLabel(data.qcStatus).toLowerCase()}
            </Pill>
          </>
        }
        description={
          <>
            {data.vendor.name}, PO{' '}
            <Link
              href={`/purchase-orders/${data.po.id}`}
              className="text-accent-2 hover:underline"
            >
              {data.po.number}
            </Link>
          </>
        }
        actions={
          <>
            {/* Reversal first and quiet: the button only opens the dialog, and
                the dialog's confirm is the one red control. */}
            {data.canReverse && (
              <Button size="sm" variant="secondary" onClick={() => setReversing(true)}>
                Reverse
              </Button>
            )}
            {data.status === 'DRAFT' ? (
              <Button
                size="sm"
                variant="primary"
                disabled={submit.isPending}
                onClick={() => act(submit, 'Sent for QC')}
              >
                Send for QC
              </Button>
            ) : data.canStartQc ? (
              <Button asChild size="sm" variant="primary">
                <Link href={`/goods-receipt/${id}/qc`}>Start QC</Link>
              </Button>
            ) : null}
            {data.canCompleteQc && (
              <Button
                asChild
                size="sm"
                variant={
                  data.canPost || data.canStartQc || data.status === 'DRAFT'
                    ? 'secondary'
                    : 'primary'
                }
              >
                <Link href={`/goods-receipt/${id}/qc`}>Continue QC</Link>
              </Button>
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
          </>
        }
      />

      <div className="mb-4 overflow-x-auto rounded-lg border border-line bg-panel p-3.5">
        <StageStrip
          stages={data.stages.map((s) => ({ key: s.key, label: s.label }))}
          activeIndex={Math.max(
            0,
            data.stages.findIndex((s) => s.state === 'active'),
          )}
          failed={data.status === 'REVERSED'}
          failedLabel={statusLabel(data.status)}
        />
      </div>

      {data.varianceFlags.length > 0 && (
        <div
          role="status"
          className="mb-4 rounded-sm bg-warn-bg px-3 py-2 text-caption text-warn"
        >
          Flags: {data.varianceFlags.map(humanise).join(', ')}
          {data.requiresPlantHeadSignoff && ', plant-head sign-off required to post'}
        </div>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title="Gate details">
            <dl className="grid gap-x-6 gap-y-2 text-caption sm:grid-cols-2">
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
          </Section>

          <Section title="Line items" flush>
            {/* Below 768px the rows stack into labelled cards (pf-stack)
                instead of scrolling six columns sideways. */}
            <table className="pf-stack w-full text-body-sm">
              <thead className="border-y border-line text-left text-caption text-muted">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Item</th>
                  <th className="px-3 py-2.5 text-right font-medium">Received</th>
                  <th className="px-3 py-2.5 text-right font-medium">Accepted</th>
                  <th className="px-3 py-2.5 text-right font-medium">Rejected</th>
                  <th className="px-3 py-2.5 font-medium">Batch</th>
                  <th className="px-3 py-2.5 text-right font-medium">Landed</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted">
                      No lines on this receipt.
                    </td>
                  </tr>
                )}
                {data.lines.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="px-3 py-3.5 text-text">{l.itemDesc}</td>
                    <td className="font-numeric px-3 py-3.5 text-right">
                      {qty(l.qtyReceived, 2)} {l.uom}
                    </td>
                    <td className="font-numeric px-3 py-3.5 text-right text-success">
                      {qty(l.qtyAccepted, 2)}
                    </td>
                    <td className="font-numeric px-3 py-3.5 text-right text-danger">
                      {Number(l.qtyRejected) > 0 ? qty(l.qtyRejected, 2) : '—'}
                    </td>
                    <td className="font-numeric px-3 py-3.5 text-faint">
                      {l.batchNumber ?? '—'}
                    </td>
                    <td className="font-numeric px-3 py-3.5 text-right">
                      {inr(l.unitLandedCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {data.lines.some((l) => l.qcSamples.length > 0) && (
            <Section title="QC samples">
              {data.lines.flatMap((l) =>
                l.qcSamples.map((s) => (
                  <div key={s.id} className="border-t border-line py-2 first:border-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-caption text-text">
                        {l.itemDesc}, sample {s.sampleSize}
                      </span>
                      <Pill variant={statusVariant(s.result)}>
                        {statusLabel(s.result)}
                      </Pill>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-micro text-faint">
                      {s.parameters.map((p) => (
                        <span
                          key={p.parameter}
                          className={p.result === 'PASS' ? 'text-success' : 'text-danger'}
                        >
                          {p.parameter}: {String(p.measured)} ({p.result})
                        </span>
                      ))}
                    </div>
                  </div>
                )),
              )}
            </Section>
          )}

          <Section title="Activity">
            {/* Rendered as a bare heading over an empty <ul> when there was no
                activity, which reads as a broken panel rather than "nothing
                has happened yet". */}
            {data.activity.length === 0 ? (
              <EmptyState
                compact
                icon={History}
                title="No activity recorded"
                detail="Receipt events will be listed here as they happen."
              />
            ) : (
              <ul className="space-y-1.5 text-caption">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3">
                    <span className="text-text">{humanise(a.action)}</span>
                    <span className="font-numeric shrink-0 text-faint">
                      {formatDateTime(a.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Section title="Total">
            <p className="font-numeric text-h2 font-semibold text-ink">
              {inr(data.totals.value)}
            </p>
          </Section>

          <Section title="Purchase order">
            <div className="text-caption">
              <Link
                href={`/purchase-orders/${data.po.id}`}
                className="font-numeric text-accent-2 hover:underline"
              >
                {data.po.number}
              </Link>
              <p className="mt-1 text-muted">
                Fulfilment {data.po.fulfilmentPct.toFixed(0)}%
              </p>
            </div>
          </Section>

          {data.rma && (
            <Section title="Return authorisation">
              <div className="flex items-center justify-between gap-2 text-caption">
                <Link
                  href={`/rma/${data.rma.id}`}
                  className="font-numeric text-accent-2 hover:underline"
                >
                  {data.rma.number}
                </Link>
                <Pill variant={statusVariant(data.rma.status)}>
                  {statusLabel(data.rma.status)}
                </Pill>
              </div>
            </Section>
          )}

          {data.invoiceLinks.length > 0 && (
            <Section title="Invoice matches">
              <div className="flex flex-col gap-1.5">
                {data.invoiceLinks.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between gap-2 text-caption"
                  >
                    <Link
                      href={`/invoices/${i.id}`}
                      className="font-numeric text-accent-2 hover:underline"
                    >
                      {i.number}
                    </Link>
                    <Pill variant={statusVariant(i.status)}>{statusLabel(i.status)}</Pill>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Stock impact">
            <div className="flex flex-col gap-2">
              {data.lines.map((l) => (
                <div key={l.id} className="flex justify-between gap-3 text-caption">
                  <span className="min-w-0 truncate text-text">{l.itemDesc}</span>
                  <span className="font-numeric shrink-0 text-faint">
                    {l.stockBefore ?? '—'} → {l.stockAfter ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {/* The trust column. Same position on every document detail page. */}
          <DocumentLedger entityId={data.id} />
        </div>
      </div>

      <ReverseDialog
        open={reversing}
        number={data.number}
        pending={reverse.isPending}
        onClose={() => setReversing(false)}
        onConfirm={(reason) =>
          reverse.mutate(reason, {
            onSuccess: () => {
              push('Receipt reversed', 'success');
              setReversing(false);
            },
            onError: (e) => push((e as Error).message, 'error'),
          })
        }
      />
    </div>
  );
}

function ReverseDialog({
  open,
  number,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  number: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}): React.JSX.Element {
  const [reason, setReason] = useState('');
  const close = (): void => {
    setReason('');
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogTitle>Reverse {number}?</DialogTitle>
        <DialogDescription className="mt-1">
          This undoes the posting of the receipt and cannot be taken back. The reason is
          kept on the record.
        </DialogDescription>
        <Field label="Reason" required className="mt-4">
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={pending}>
            Back
          </Button>
          <Button
            variant="danger"
            disabled={!reason.trim() || pending}
            onClick={() => onConfirm(reason.trim())}
          >
            Reverse receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A titled card. `flush` drops the body padding so a table can run edge to edge. */
function Section({
  title,
  flush,
  children,
}: {
  title: string;
  flush?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className={flush ? 'px-0 pb-0' : undefined}>{children}</CardContent>
    </Card>
  );
}

function Def({ k, v }: { k: string; v: string | null }): React.JSX.Element {
  return (
    <div>
      <dt className="text-faint">{k}</dt>
      <dd className="font-numeric break-words text-text">{v ?? '—'}</dd>
    </div>
  );
}
