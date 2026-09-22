'use client';

import {
  ApprovalChain,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  KpiCard,
  PageHeader,
  Pill,
  Skeleton,
} from '@/components/ui';
import { AlertTriangle, ArrowLeft, Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PaymentRunDetailResponse, PaymentRunItemView } from '@/lib/shared';

import { DocumentLedger } from '@/components/document-ledger';

import { SuggestDrawer } from '@/components/payments/suggest-drawer';
import {
  useCancelPaymentRun,
  useDecidePaymentRun,
  usePaymentRun,
  useRemovePaymentItem,
  useSetPaymentItemAmount,
  useSubmitForApproval,
} from '@/lib/api/payments';
import { formatDate, formatDateTime, inr, statusLabel, statusVariant } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';
import { BankReconciliationPanel } from './_bank-reconciliation';

const MD_THRESHOLD = 5_000_000; // ₹50L — above this the MD step applies.

export default function PaymentRunDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const { data, isLoading, error, refetch } = usePaymentRun(id);
  const submit = useSubmitForApproval(id);
  const remove = useRemovePaymentItem(id);
  const decide = useDecidePaymentRun(id);
  const cancel = useCancelPaymentRun(id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [decisionComment, setDecisionComment] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (error) {
    return (
      <div>
        <BackLink />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }
  if (isLoading || !data) return <RunSkeleton />;

  const isDraft = data.status === 'DRAFT';
  const isAwaiting = data.status === 'AWAITING_APPROVAL';
  const isSubmitted = data.status === 'SUBMITTED_TO_BANK';

  const onSubmit = (): void =>
    submit.mutate(undefined, {
      onSuccess: () => toast('Submitted for approval', 'success'),
      onError: (e) => toast((e as Error).message, 'error'),
    });

  const onDecide = (decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'): void => {
    if (!data.myApprovalId) return;
    decide.mutate(
      { approvalId: data.myApprovalId, decision, comment: decisionComment || undefined },
      {
        onSuccess: () => {
          toast(decision === 'APPROVE' ? 'Approved' : 'Decision recorded', 'success');
          router.push('/inbox');
        },
        onError: (e) => toast((e as Error).message, 'error'),
      },
    );
  };

  const downloadFile = (): void => {
    if (!data.bankFilePreview) return;
    const blob = new Blob([data.bankFilePreview.content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.bankFilePreview.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={isAwaiting ? 'pb-28' : 'pb-8'}>
      <BackLink />

      <PageHeader
        title={data.number}
        numeric
        meta={
          <Pill variant={statusVariant(data.status)} dot>
            {statusLabel(data.status)}
          </Pill>
        }
        description={
          <>
            Cycle {formatDate(data.cycleDate)}{' · '}
            {data.bankAccount?.bankName ?? '—'} ••••{data.bankAccount?.accountNoLast4}
          </>
        }
        actions={
          isDraft ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setDrawerOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add invoices
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={submit.isPending || data.items.length === 0}
                onClick={onSubmit}
              >
                Submit for approval
              </Button>
            </>
          ) : undefined
        }
      />

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Invoices" value={String(data.kpis.itemCount)} />
        <KpiCard label="Gross" value={inr(data.kpis.gross)} />
        <KpiCard label="TDS" value={inr(data.kpis.tdsTotal)} />
        <KpiCard label="Net" value={inr(data.kpis.net)} />
        <KpiCard label="MSME priority" value={String(data.kpis.msmePriorityCount)} />
      </div>

      {/* MSME risk pre-check */}
      {data.msmeAudit.atRisk.length > 0 && (
        <div className="border-danger/30 bg-danger-wash mb-5 flex items-start gap-2 rounded-lg border p-3">
          <AlertTriangle className="text-danger mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="text-caption">
            <span className="text-danger font-semibold">
              {data.msmeAudit.atRisk.length} MSME invoice
              {data.msmeAudit.atRisk.length === 1 ? '' : 's'} at day 40+ NOT in this run
            </span>
            <span className="text-danger/80">
              {' '}
              — add them or document an exclusion reason:{' '}
              {data.msmeAudit.atRisk.map((r) => r.number).join(', ')}.
            </span>
          </div>
        </div>
      )}

      {/* Submitted banner */}
      {isSubmitted && (
        <div className="border-success/30 bg-success-bg mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0 text-caption">
            <Pill variant="success" dot>
              Submitted
            </Pill>
            <span className="text-text ml-2">
              {data.submittedAt && `${formatDateTime(data.submittedAt)}. `}
              Sent as a file, not through a bank API. File hash{' '}
              <span className="font-numeric">{data.bankFileHash?.slice(0, 8)}…</span>
            </span>
          </div>
          <Button size="sm" variant="primary" onClick={downloadFile}>
            <Download className="h-3.5 w-3.5" aria-hidden /> Download .csv
          </Button>
        </div>
      )}

      {/* items-start: the aside is usually taller than a short batch, and a
          stretched batch card left a tall empty panel under the total. The
          approval route and bank reconciliation sit in the main column under
          the batch rather than full-width below both, so a one-invoice run
          does not strand a gap beside the bank-file preview. */}
      <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Batch table */}
          <Card className="min-w-0 overflow-hidden">
            <div className="border-line flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-ink text-h3 font-semibold">
                Payment batch
                <span className="text-muted ml-2 text-body-sm font-normal">
                  {data.items.length} invoice{data.items.length === 1 ? '' : 's'}
                </span>
              </h2>
            </div>
            <table className="pf-stack w-full text-body-sm">
              <thead className="border-line border-b text-left text-caption text-muted">
                <tr>
                  <th className="w-8 px-3 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Invoice</th>
                  <th className="px-3 py-2.5 font-medium">Vendor</th>
                  <th className="px-3 py-2.5 text-right font-medium">Paying</th>
                  <th className="px-3 py-2.5 text-right font-medium">TDS</th>
                  <th className="px-3 py-2.5 text-right font-medium">Net</th>
                  {isDraft && <th className="w-8 px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={isDraft ? 7 : 6} className="p-0">
                      <EmptyState
                        title="No invoices in this run yet"
                        detail={
                          isDraft
                            ? 'Add approved invoices to build the batch and preview the bank file.'
                            : 'This run was closed without any invoices.'
                        }
                        action={
                          isDraft ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setDrawerOpen(true)}
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden /> Add invoices
                            </Button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                )}
                {data.items.map((it) => (
                  <tr key={it.id} className="border-line border-t">
                    <td className="font-numeric text-faint px-3 py-3">{it.orderInBatch}</td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/invoices/${it.invoiceId}`}
                        className="font-numeric text-ink font-medium"
                      >
                        {it.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-text">{it.vendorName}</span>
                      {it.isMsme && (
                        <Badge variant="classification" className="ml-1.5">MSME</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <PayAmountCell runId={id} item={it} editable={isDraft} />
                    </td>
                    <td className="font-numeric text-muted px-3 py-3 text-right">
                      {inr(it.tds)}
                    </td>
                    <td className="font-numeric text-ink px-3 py-3 text-right font-medium">
                      {inr(it.net)}
                    </td>
                    {isDraft && (
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          aria-label={`Remove ${it.invoiceNumber}`}
                          className="text-muted hover:text-danger text-caption"
                          onClick={() =>
                            remove.mutate(it.invoiceId, {
                              onSuccess: () => toast('Removed', 'success'),
                            })
                          }
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {/* The stacked mobile layout only handles <tbody>; on a phone the KPI
                  strip above already carries these totals. */}
              {data.items.length > 0 && (
                <tfoot className="hidden md:table-footer-group">
                  <tr className="border-line bg-canvas border-t">
                    <td
                      colSpan={3}
                      className="text-muted px-3 py-2.5 text-caption font-medium"
                    >
                      Total
                    </td>
                    <td className="font-numeric text-text px-3 py-2.5 text-right">
                      {inr(data.kpis.gross)}
                    </td>
                    <td className="font-numeric text-muted px-3 py-2.5 text-right">
                      {inr(data.kpis.tdsTotal)}
                    </td>
                    <td className="font-numeric text-ink px-3 py-2.5 text-right font-semibold">
                      {inr(data.kpis.net)}
                    </td>
                    {isDraft && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </Card>

          {/* Approval flow. The composer and the bank hand-off are not approval
              steps — they bracket the route — so they stay outside the chain while
              the approvals themselves render through the shared component. */}
          <section>
            <h2 className="text-ink mb-2 text-h3 font-semibold">Approval route</h2>
            <div className="border-line bg-panel rounded-lg border p-4">
              <ApprovalChain
                steps={[
                  ...data.liveApprovalChain,
                  ...(mdSkipped(data)
                    ? [
                        {
                          stepNo: 99,
                          name: 'Managing Director',
                          role: 'MANAGING_DIRECTOR',
                          slaHours: 0,
                          parallelGroup: null,
                          approverName: 'Managing Director',
                          decision: 'PENDING' as const,
                          skipped: true,
                          skipReason: 'Skipped — run is below the ₹50L MD threshold.',
                        },
                      ]
                    : []),
                ]}
              />

              <dl className="border-line text-muted mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-micro">
                <div className="flex gap-1.5">
                  <dt>Composed by</dt>
                  <dd className="text-text font-medium">{data.composedByName ?? '—'}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>Bank submission</dt>
                  <dd className="text-text font-medium">
                    {isSubmitted
                      ? 'Sent'
                      : data.status === 'APPROVED'
                        ? 'Ready to send'
                        : 'Not yet'}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <BankReconciliationPanel runId={id} status={data.status} />
        </div>

        {/* Bank file preview */}
        <aside className="flex min-w-0 flex-col gap-4">
          <Card className="overflow-hidden">
            <div className="border-line flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-ink text-h3 font-semibold">Bank file preview</h2>
              {/* The watermark tag used to float over the file's first line and
                  hide the figures under it; it sits in the header instead. */}
              <span className="flex items-center gap-2">
                {data.bankFilePreview?.watermarked && <Badge variant="neutral">Not final</Badge>}
                <span className="text-faint font-numeric text-micro">
                  {data.bankAccount?.formatKey}
                </span>
              </span>
            </div>
            {data.bankFilePreview ? (
              <div>
                <pre className="text-text max-h-72 overflow-auto whitespace-pre px-4 py-3 font-mono text-micro leading-relaxed">
                  {data.bankFilePreview.content}
                </pre>
                <div className="border-line text-faint flex items-center justify-between border-t px-4 py-2 text-micro">
                  <span>
                    {data.bankFilePreview.rowCount} rows, hash{' '}
                    <span className="font-numeric">
                      {data.bankFilePreview.checksum.slice(0, 8)}…
                    </span>
                  </span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto text-micro"
                    onClick={downloadFile}
                    disabled={data.bankFilePreview.watermarked && !isSubmitted}
                  >
                    Download .csv
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                compact
                title="No file yet"
                detail="The bank file is generated once the run holds at least one invoice."
              />
            )}
          </Card>

          {/* The trust column. Same position on every document detail page. */}
          <DocumentLedger entityId={data.id} />
        </aside>
      </div>

      {/* Sticky action bar */}
      {isAwaiting && (
        <div className="border-line bg-panel/95 fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur">
          <div className="pf-container flex flex-wrap items-center justify-between gap-2 py-3 sm:gap-3">
            {data.canDecide ? (
              <>
                <Input
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder="Add a decision comment…"
                  aria-label="Decision comment"
                  className="min-w-0 flex-1 basis-full sm:basis-auto"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={decide.isPending}
                    onClick={() => onDecide('REJECT')}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={decide.isPending}
                    onClick={() => onDecide('REQUEST_CHANGES')}
                  >
                    Request changes
                  </Button>
                  {/* Approving a payment run releases money to vendors — the
                      single most consequential action in the product. */}
                  <Button
                    variant="primary"
                    disabled={decide.isPending}
                    onClick={() => onDecide('APPROVE')}
                  >
                    Approve
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-muted ml-auto flex flex-wrap items-center gap-3 text-body-sm">
                <span>
                  Waiting for{' '}
                  {data.liveApprovalChain.find((s) => s.isCurrent)?.approverName ??
                    'the current approver'}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)}>
                  Cancel run
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <SuggestDrawer runId={id} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Cancelling withdraws the run from its approvers and cannot be undone,
          so it gets the same confirm step as every other destructive action. */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogTitle>Cancel {data.number}?</DialogTitle>
          <DialogDescription>
            The run is withdrawn from approval and its invoices become payable again.
            This cannot be undone.
          </DialogDescription>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(false)}>
              Keep run
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={cancel.isPending}
              onClick={() =>
                cancel.mutate('Cancelled by composer', {
                  onSuccess: () => {
                    setConfirmCancel(false);
                    toast('Run cancelled', 'success');
                  },
                  onError: (e) => toast((e as Error).message, 'error'),
                })
              }
            >
              Cancel run
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * What the run pays of one invoice. Starts at the invoice's outstanding
 * balance; on a draft run it can be lowered to pay only part — the rest stays
 * payable and the invoice reads "Partially paid" once the bank confirms.
 */
function PayAmountCell({
  runId,
  item,
  editable,
}: {
  runId: string;
  item: PaymentRunItemView;
  editable: boolean;
}): React.JSX.Element {
  const toast = useToastStore((s) => s.push);
  const setAmount = useSetPaymentItemAmount(runId);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const outstanding = Number(item.outstanding);
  const paidBefore = Number(item.paidBefore);

  const start = (): void => {
    setValue(Number(item.gross).toFixed(2));
    setEditing(true);
  };
  const save = (amount: string): void =>
    setAmount.mutate(
      { invoiceId: item.invoiceId, amount },
      {
        onSuccess: () => {
          setEditing(false);
          toast(`${item.invoiceNumber} will pay ${inr(amount)}`, 'success');
        },
        onError: (e) => toast((e as Error).message, 'error'),
      },
    );
  const share = (fraction: number): string =>
    (Math.round(outstanding * fraction * 100) / 100).toFixed(2);

  if (editing) {
    const n = Number(value);
    const valid = Number.isFinite(n) && n > 0 && n <= outstanding + 0.005;
    return (
      <div className="flex flex-col items-end gap-1">
        <input
          autoFocus
          inputMode="decimal"
          value={value}
          aria-label={`Amount to pay on ${item.invoiceNumber}`}
          aria-invalid={!valid}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && valid) save(n.toFixed(2));
            if (e.key === 'Escape') setEditing(false);
          }}
          className="font-numeric w-28 rounded-sm border border-line bg-panel px-2 py-1 text-right text-body-sm outline-none aria-[invalid=true]:border-danger"
        />
        <div className="flex gap-1 text-micro">
          <button
            type="button"
            className="text-muted hover:text-text"
            onClick={() => setValue(share(1))}
          >
            Full
          </button>
          <span className="text-faint">·</span>
          <button
            type="button"
            className="text-muted hover:text-text"
            onClick={() => setValue(share(0.5))}
          >
            50%
          </button>
          <span className="text-faint">·</span>
          <button
            type="button"
            className="font-medium text-accent-2 disabled:opacity-50"
            disabled={!valid || setAmount.isPending}
            onClick={() => save(n.toFixed(2))}
          >
            Save
          </button>
          <button type="button" className="text-muted" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
        <div className="text-micro text-faint">max {inr(item.outstanding)}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      {editable ? (
        <button
          type="button"
          onClick={start}
          title="Change how much of this invoice the run pays"
          className="font-numeric text-text underline decoration-line decoration-dotted underline-offset-2 hover:text-accent-2"
        >
          {inr(item.gross)}
        </button>
      ) : (
        <span className="font-numeric text-text">{inr(item.gross)}</span>
      )}
      {item.isPartial && (
        <span className="text-micro text-info">
          part-payment · {inr(outstanding - Number(item.gross))} left after
        </span>
      )}
      {paidBefore > 0 && (
        <span className="text-micro text-faint">{inr(paidBefore)} paid earlier</span>
      )}
    </div>
  );
}

function mdSkipped(data: PaymentRunDetailResponse): boolean {
  const hasMd = data.liveApprovalChain.some(
    (s) => /director/i.test(s.name) || s.role === 'MD',
  );
  return !hasMd && Number(data.kpis.gross) <= MD_THRESHOLD && data.status !== 'DRAFT';
}

function BackLink(): React.JSX.Element {
  return (
    <Link
      href="/payment-runs"
      className="text-muted hover:text-text mb-3 inline-flex items-center gap-1 text-caption"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to payment runs
    </Link>
  );
}

/** Shaped like the page it stands in for, so nothing jumps when data lands. */
function RunSkeleton(): React.JSX.Element {
  return (
    <div aria-busy="true" aria-live="polite">
      <BackLink />
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <KpiCard key={i} label="" value="" isLoading />
        ))}
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}
