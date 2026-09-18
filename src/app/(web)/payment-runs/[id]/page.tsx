'use client';

import { ApprovalChain, Badge, Button, PageHeader, Pill } from '@/components/ui';
import { AlertTriangle, ArrowLeft, Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PaymentRunDetailResponse } from '@/lib/shared';

import { DocumentLedger } from '@/components/document-ledger';

import { SuggestDrawer } from '@/components/payments/suggest-drawer';
import {
  useCancelPaymentRun,
  useDecidePaymentRun,
  usePaymentRun,
  useRemovePaymentItem,
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
  const { data, isLoading } = usePaymentRun(id);
  const submit = useSubmitForApproval(id);
  const remove = useRemovePaymentItem(id);
  const decide = useDecidePaymentRun(id);
  const cancel = useCancelPaymentRun(id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [decisionComment, setDecisionComment] = useState('');

  if (isLoading || !data) {
    return <div className="text-muted p-6 text-[13px]">Loading payment run…</div>;
  }

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
    <div className="pb-24">
      <Link
        href="/payment-runs"
        className="text-muted mb-3 inline-flex items-center gap-1 text-[12px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to payment runs
      </Link>

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
            Cycle {formatDate(data.cycleDate)} ,{' '}
            {data.bankAccount?.bankName ?? '—'} ••••{data.bankAccount?.accountNoLast4}
          </>
        }
        actions={
          isDraft ? (
            <>
              <Button size="sm" variant="default" onClick={() => setDrawerOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add invoices
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
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Invoices" value={String(data.kpis.itemCount)} />
        <Kpi label="Gross" value={inr(data.kpis.gross)} />
        <Kpi label="TDS" value={inr(data.kpis.tdsTotal)} />
        <Kpi label="Net" value={inr(data.kpis.net)} accent />
        <Kpi label="MSME priority" value={String(data.kpis.msmePriorityCount)} />
      </div>

      {/* MSME risk pre-check */}
      {data.msmeAudit.atRisk.length > 0 && (
        <div className="border-danger/30 bg-danger-wash mb-4 flex items-start gap-2 rounded-lg border p-3">
          <AlertTriangle className="text-danger mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-[12px]">
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
        <div className="border-accent/30 bg-accent-wash mb-4 flex items-center justify-between rounded-lg border p-3">
          <div className="text-[12px]">
            <Pill variant="success" dot>
              Submitted
            </Pill>
            <span className="text-accent-2 ml-2">
              {data.submittedAt && formatDateTime(data.submittedAt)} ,
              Stub mode: no bank API called (enabled in Slice 10), file hash{' '}
              <span className="font-numeric">{data.bankFileHash?.slice(0, 8)}…</span>
            </span>
          </div>
          <Button size="sm" variant="primary" onClick={downloadFile}>
            <Download className="mr-1 h-3.5 w-3.5" /> Download .csv
          </Button>
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Batch table */}
        <section className="border-line bg-panel rounded-lg border">
          <div className="border-line flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="text-ink text-[13px] font-semibold">
              Payment batch — {data.items.length} invoice
              {data.items.length === 1 ? '' : 's'}
            </h2>
          </div>
          <table className="w-full text-[13px]">
            <thead className="border-line border-b text-left text-[12px] text-muted">
              <tr>
                <th className="w-8 px-3 py-2">#</th>
                <th className="px-3 py-2 font-medium">Invoice</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 text-right font-medium">Gross</th>
                <th className="px-3 py-2 text-right font-medium">TDS</th>
                <th className="px-3 py-2 text-right font-medium">Net</th>
                {isDraft && <th className="w-8 px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td
                    colSpan={isDraft ? 7 : 6}
                    className="text-muted px-3 py-8 text-center"
                  >
                    No invoices yet. Click “Add invoices”.
                  </td>
                </tr>
              )}
              {data.items.map((it) => (
                <tr key={it.id} className="border-line border-t">
                  <td className="font-numeric text-faint px-3 py-2">{it.orderInBatch}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/invoices/${it.invoiceId}`}
                      className="font-numeric text-ink font-medium"
                    >
                      {it.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-text">{it.vendorName}</span>
                    {it.isMsme && (
                      <Badge variant="classification" className="ml-1.5">MSME</Badge>
                    )}
                  </td>
                  <td className="font-numeric text-text px-3 py-2 text-right">
                    {inr(it.gross)}
                  </td>
                  <td className="font-numeric text-muted px-3 py-2 text-right">
                    {inr(it.tds)}
                  </td>
                  <td className="font-numeric text-ink px-3 py-2 text-right font-medium">
                    {inr(it.net)}
                  </td>
                  {isDraft && (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        aria-label={`Remove ${it.invoiceNumber}`}
                        className="text-muted hover:text-danger text-[12px]"
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
            {data.items.length > 0 && (
              <tfoot>
                <tr className="border-line bg-canvas border-t">
                  <td
                    colSpan={3}
                    className="text-muted px-3 py-2 text-[12px] font-medium"
                  >
                    Total
                  </td>
                  <td className="font-numeric text-text px-3 py-2 text-right">
                    {inr(data.kpis.gross)}
                  </td>
                  <td className="font-numeric text-muted px-3 py-2 text-right">
                    {inr(data.kpis.tdsTotal)}
                  </td>
                  <td className="font-numeric text-ink px-3 py-2 text-right font-semibold">
                    {inr(data.kpis.net)}
                  </td>
                  {isDraft && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </section>

        {/* Bank file preview */}
        <aside className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <div className="border-line flex items-center justify-between border-b px-4 py-2.5">
              <h2 className="text-ink text-[13px] font-semibold">Bank file preview</h2>
              <span className="text-faint font-numeric text-[11px]">
                {data.bankAccount?.formatKey}
              </span>
            </div>
            {data.bankFilePreview ? (
              <div className="relative">
                {data.bankFilePreview.watermarked && (
                  <div className="text-faint/60 pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] font-semibold tracking-widest">
                    Preview
                  </div>
                )}
                <pre className="text-text max-h-72 overflow-auto whitespace-pre px-4 py-3 font-mono text-[11px] leading-relaxed">
                  {data.bankFilePreview.content}
                </pre>
                <div className="border-line text-faint flex items-center justify-between border-t px-4 py-2 text-[11px]">
                  <span>
                    {data.bankFilePreview.rowCount} rows, hash{' '}
                    <span className="font-numeric">
                      {data.bankFilePreview.checksum.slice(0, 8)}…
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-accent-2"
                    onClick={downloadFile}
                    disabled={data.bankFilePreview.watermarked && !isSubmitted}
                  >
                    Download .csv
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-muted p-4 text-[12px]">
                Add invoices to preview the bank file.
              </div>
            )}
          </div>

          {/* The trust column. Same position on every document detail page. */}
          <DocumentLedger entityId={data.id} />
        </aside>
      </div>

      {/* Approval flow. The composer and the bank hand-off are not approval
          steps — they bracket the route — so they stay outside the chain while
          the approvals themselves render through the shared component. */}
      <section className="mt-5">
        <h2 className="text-ink mb-2 text-[14px] font-semibold">Approval route</h2>
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

          <dl className="border-line text-muted mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-[11px]">
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

      {/* Sticky action bar */}
      {isAwaiting && (
        <div className="border-line bg-panel/95 fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6">
            {data.canDecide ? (
              <>
                <input
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder="Add a decision comment…"
                  aria-label="Decision comment"
                  className="border-line bg-panel min-w-0 flex-1 basis-full rounded-sm border px-3 py-2 text-[13px] outline-none sm:basis-auto"
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={decide.isPending}
                    onClick={() => onDecide('REJECT')}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="default"
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
              <div className="text-muted ml-auto text-[13px]">
                Waiting for{' '}
                {data.liveApprovalChain.find((s) => s.isCurrent)?.approverName ??
                  'the current approver'}
                <Button
                  className="ml-3"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    cancel.mutate('Cancelled by composer', {
                      onSuccess: () => toast('Run cancelled', 'success'),
                    })
                  }
                >
                  Cancel run
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <SuggestDrawer runId={id} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

function mdSkipped(data: PaymentRunDetailResponse): boolean {
  const hasMd = data.liveApprovalChain.some(
    (s) => /director/i.test(s.name) || s.role === 'MD',
  );
  return !hasMd && Number(data.kpis.gross) <= MD_THRESHOLD && data.status !== 'DRAFT';
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel rounded-lg border p-3">
      <div className="text-faint text-[11px]">{label}</div>
      <div className={
          'font-numeric tracking-display mt-1 text-[16px] font-semibold ' +
          (accent ? 'text-accent-2' : 'text-ink')
        }
      >
        {value}
      </div>
    </div>
  );
}

function ChainStep({
  label,
  state,
  sub,
}: {
  label: string;
  state: 'done' | 'current' | 'todo' | 'skipped';
  sub?: string;
}): React.JSX.Element {
  const cls =
    state === 'current'
      ? 'border-accent bg-accent-wash'
      : state === 'skipped'
        ? 'border-line bg-canvas opacity-50'
        : 'border-line bg-panel';
  return (
    <span className={`flex flex-col rounded-sm border px-2.5 py-1.5 text-[12px] ${cls}`}>
      <span className="text-text font-medium">{label}</span>
      {sub && <span className="text-faint text-[10px]">{sub}</span>}
    </span>
  );
}

