'use client';

import { openAuthedAsset } from '@/lib/api-client';
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
  Input,
  PageHeader,
  Pill,
  Skeleton,
  Textarea,
} from '@/components/ui';
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
import {
  formatDateTime,
  humanise,
  inr,
  qty,
  statusLabel,
  statusVariant,
} from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

/** Which two-field capture dialog is open. Both replace a pair of browser prompts. */
type Capture = 'pickup' | 'credit' | null;

export default function RmaDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const push = useToastStore((s) => s.push);
  const { data, isLoading, error, refetch } = useRma(id);
  const update = useUpdateRma(id);
  const issue = useIssueRma(id);
  const pickup = useRecordRmaPickup(id);
  const creditNote = useRecordCreditNote(id);
  const close = useCloseRma(id);

  const [notes, setNotes] = useState('');
  const [capture, setCapture] = useState<Capture>(null);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');

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
        <Skeleton className="h-4 w-64" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const openCapture = (c: Capture): void => {
    setFirst('');
    setSecond('');
    setCapture(c);
  };
  const saveCapture = (): void => {
    const done = {
      onSuccess: () => {
        push(
          capture === 'pickup' ? 'Pickup recorded' : 'Credit note recorded',
          'success',
        );
        setCapture(null);
      },
      onError: (e: Error) => push(e.message, 'error'),
    };
    if (capture === 'pickup')
      pickup.mutate({ vehicleOutNo: first.trim(), gatePassOutNo: second.trim() }, done);
    else if (capture === 'credit')
      creditNote.mutate(
        { creditNoteRef: first.trim(), creditNoteAmount: second.trim() },
        done,
      );
  };

  // One filled button: the next step in the return's life. Close is the tail
  // end and stays secondary.
  const nextStep = data.canIssue
    ? 'issue'
    : data.canRecordPickup
      ? 'pickup'
      : data.canRecordCreditNote
        ? 'credit'
        : null;

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Return authorisations', href: '/rma' },
          { label: data.number },
        ]}
        title={data.number}
        numeric
        meta={
          <Pill variant={statusVariant(data.status)} dot>
            {statusLabel(data.status)}
          </Pill>
        }
        description={
          <>
            {data.vendor.name}, GRN{' '}
            <Link
              href={`/goods-receipt/${data.grn.id}`}
              className="text-accent hover:underline"
            >
              {data.grn.number}
            </Link>
          </>
        }
        actions={
          <>
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
            {data.canClose && (
              <Button
                size="sm"
                variant="secondary"
                disabled={close.isPending}
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
            {data.canIssue && (
              <Button
                size="sm"
                variant={nextStep === 'issue' ? 'primary' : 'secondary'}
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
                variant={nextStep === 'pickup' ? 'primary' : 'secondary'}
                onClick={() => openCapture('pickup')}
              >
                Record pickup
              </Button>
            )}
            {data.canRecordCreditNote && (
              <Button
                size="sm"
                variant={nextStep === 'credit' ? 'primary' : 'secondary'}
                onClick={() => openCapture('credit')}
              >
                Record credit note
              </Button>
            )}
          </>
        }
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Return lines</CardTitle>
            </CardHeader>
            <table className="pf-stack w-full text-body-sm">
              <thead className="border-y border-line text-left text-caption text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Rate</th>
                  <th className="px-4 py-2.5 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted">
                      No lines on this return.
                    </td>
                  </tr>
                )}
                {data.lines.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="px-4 py-3.5 text-text">{l.itemDesc}</td>
                    <td className="font-numeric px-3 py-3.5 text-right">
                      {qty(l.qtyReturned, 2)} {l.uom}
                    </td>
                    <td className="font-numeric px-3 py-3.5 text-right">
                      {inr(l.unitPrice)}
                    </td>
                    <td className="font-numeric px-4 py-3.5 text-right">
                      {inr(l.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {data.canEdit && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Refine reason</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={3}
                  aria-label="Return reason detail"
                  placeholder={data.reasonNotes ?? 'Add return reason detail…'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
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
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {data.activity.length === 0 ? (
                <EmptyState
                  compact
                  title="No activity recorded"
                  detail="Return events will be listed here as they happen."
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
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-caption">
            <Row k="Reason" v={humanise(data.reasonCode)} />
            <Row k="Freight borne by" v={humanise(data.returnFreightBorneBy)} />
            <Row k="Vehicle out" v={data.vehicleOutNo ?? '—'} />
            <Row k="Gate-pass out" v={data.gatePassOutNo ?? '—'} />
            <Row k="Credit note" v={data.creditNoteRef ?? '—'} />
            <Row
              k="Credit amount"
              v={data.creditNoteAmount ? inr(data.creditNoteAmount) : '—'}
            />
            <div className="mt-2 border-t border-line pt-2">
              <Row k="Total return" v={inr(data.totalReturnValue)} bold />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={capture !== null} onOpenChange={(o) => !o && setCapture(null)}>
        <DialogContent>
          <DialogTitle>
            {capture === 'pickup' ? 'Record pickup' : 'Record credit note'}
          </DialogTitle>
          <DialogDescription className="mt-1">
            {capture === 'pickup'
              ? 'The vehicle and gate pass the returned goods left on.'
              : 'The vendor’s credit note against this return.'}
          </DialogDescription>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label={capture === 'pickup' ? 'Vehicle out no.' : 'Credit note ref'}
              required
            >
              <Input value={first} onChange={(e) => setFirst(e.target.value)} autoFocus />
            </Field>
            <Field
              label={capture === 'pickup' ? 'Gate-pass out no.' : 'Amount (₹)'}
              required
            >
              <Input
                value={second}
                inputMode={capture === 'credit' ? 'decimal' : undefined}
                onChange={(e) => setSecond(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setCapture(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                !first.trim() ||
                !second.trim() ||
                pickup.isPending ||
                creditNote.isPending
              }
              onClick={saveCapture}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
    <div className="flex justify-between gap-3 py-0.5">
      <span className="shrink-0 text-muted">{k}</span>
      <span
        className={
          'font-numeric min-w-0 text-right ' +
          (bold ? 'font-semibold text-ink' : 'text-text')
        }
      >
        {v}
      </span>
    </div>
  );
}
