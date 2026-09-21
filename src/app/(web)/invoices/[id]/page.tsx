'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  PageHeader,
  Pill,
  SubNav,
  VerificationResult,
} from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  PERMISSIONS,
  type InvoiceExceptionView,
  type InvoicePaymentInfo,
} from '@/lib/shared';

import { DocumentLedger } from '@/components/document-ledger';
import { EntityRef } from '@/components/entity-ref';
import { RecordPaymentModal } from '@/components/invoices/record-payment-modal';
import { ResolveModal } from '@/components/invoices/resolve-modal';
import { TaxInvoiceForm } from '@/components/invoices/tax-invoice-form';
import { useDecide } from '@/lib/api/inbox';
import {
  useAddComment,
  useAttachTaxInvoice,
  useInvoice,
  useResolveAndRoute,
  useRetryOcr,
  useSetDocumentKind,
  // useRunMatch,
} from '@/lib/api/invoices';
import { exceptionLabel, impactLabel } from '@/lib/exception-display';
import { formatDate, formatDateTime, inr, inrCompact, msmeVariant, statusLabel, statusVariant } from '@/lib/format';
import { COMPLIANCE_PROVIDER, useProviderLiveness } from '@/lib/integration-status';
import { useHasPermission } from '@/lib/permissions';
import { useToastStore } from '@/store/toast-store';

export default function InvoiceDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { data, isLoading } = useInvoice(id);
  const route = useResolveAndRoute(id);
  const retryOcr = useRetryOcr(id);
  // Paired with the commented-out Re-run match button below.
  // const runMatch = useRunMatch(id);
  const addComment = useAddComment(id);
  const decide = useDecide();
  const toast = useToastStore((s) => s.push);
  const [resolving, setResolving] = useState<InvoiceExceptionView | null>(null);
  const [comment, setComment] = useState('');
  const [decisionComment, setDecisionComment] = useState('');
  const [activityTab, setActivityTab] = useState<'activity' | 'payments'>('activity');
  // No `simulated` flag rides on invoice compliance, so provenance is inferred
  // from whether live credentials exist for the provider behind each field.
  const { isSimulated } = useProviderLiveness();
  const canPay = useHasPermission(PERMISSIONS.INVOICE_PAY);
  const canResolve = useHasPermission(PERMISSIONS.INVOICE_RESOLVE_EXCEPTION);
  const canIntake = useHasPermission(PERMISSIONS.INVOICE_INTAKE_MANAGE);
  const [recording, setRecording] = useState(false);
  const [attachingTax, setAttachingTax] = useState(false);
  const setKind = useSetDocumentKind(id);
  const attachTax = useAttachTaxInvoice(id);

  if (isLoading || !data) {
    return <div className="p-6 text-body-sm text-muted">Loading invoice…</div>;
  }

  // Exceptions raised on a proforma since replaced by its tax invoice are kept
  // for the record, but they describe a different document.
  const currentExceptions = data.exceptions.filter((e) => !e.superseded);
  const proformaExceptions = data.exceptions.filter((e) => e.superseded);
  const openExceptions = currentExceptions.filter((e) => !e.resolved);
  // An exception someone waved through is not the same as one that never
  // fired. "0 open" reads identically for a clean match and for an overridden
  // HIGH GRN_MISSING, so overrides are counted and shown separately.
  const overridden = currentExceptions.filter(
    (e) => e.resolved && (e.severity === 'HIGH' || e.severity === 'CRITICAL'),
  );
  // An empty exception list means "clean match" only once a match has run. While
  // OCR is pending or has failed, the matcher has never looked at this invoice,
  // so zero exceptions says nothing — and routing on it would send an unmatched
  // invoice into the approval chain. These are the states the matcher leaves.
  const matched = data.status === 'OCR_DONE' || data.status === 'MATCH_EXCEPTION';
  // Mirrors the server guard: past these two, lines exist and may have been
  // corrected by hand, and re-extracting would overwrite that work.
  const retryable = data.status === 'OCR_PENDING' || data.status === 'OCR_FAILED';
  // A payment made outside a run can be recorded against an approved invoice
  // with something still owing — unless a run already holds it, in which case
  // that run is committed to paying its amount.
  const partlyPaid = Number(data.amountPaid) > 0;
  // Approved means cleared: the status alone can say APPROVED while an
  // exception is still open or an approver has yet to decide (mirrors the API).
  const payable =
    (data.status === 'APPROVED' || data.status === 'PARTIALLY_PAID') &&
    Number(data.amountOutstanding) > 0 &&
    openExceptions.length === 0 &&
    !data.liveApprovalChain.some((s) => s.decision === 'PENDING') &&
    !data.paymentBlockedReason;
  const isProforma = data.documentKind === 'PROFORMA';
  // Mirrors TAX_INVOICE_REFUSED on the server.
  const taxInvoiceWait = TAX_INVOICE_WAIT[data.status];
  // Routing belongs to the pre-approval pipeline. Past it the button only ever
  // failed; it used to show on paid invoices too.
  const routable = PRE_APPROVAL.includes(data.status);
  const remainingTds = Math.max(
    Number(data.amounts.tdsAmount) -
      data.payments.reduce((sum, p) => sum + Number(p.tds), 0),
    0,
  ).toFixed(2);

  const onRoute = (): void => {
    route.mutate(undefined, {
      onSuccess: (res) => {
        toast(
          res.outcome === 'APPROVAL_CARRIED_OVER'
            ? 'Tax invoice confirmed. The proforma approval still holds.'
            : res.reasons.length > 0
              ? `Sent back for approval: ${res.reasons[0]}`
              : 'Routed for approval',
          'success',
        );
        router.push('/invoices');
      },
      // Surface the API's reason — "resolve the exceptions" and "the match has
      // not run yet" are different problems with different fixes.
      onError: (e) =>
        toast((e as Error).message || 'Could not route this invoice', 'error'),
    });
  };

  const onDecide = (decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'): void => {
    if (!data.myApprovalId) return;
    decide.mutate(
      { approvalId: data.myApprovalId, decision, comment: decisionComment || undefined },
      {
        onSuccess: () => {
          toast(
            decision === 'APPROVE'
              ? 'Approved'
              : decision === 'REJECT'
                ? 'Rejected'
                : 'Changes requested',
            decision === 'REJECT' ? 'error' : 'success',
          );
          router.push('/inbox');
        },
        onError: (e) => toast((e as Error).message, 'error'),
      },
    );
  };

  return (
    <div className="pb-20">
      <Link
        href="/invoices"
        className="mb-3 inline-flex items-center gap-1 text-caption text-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to invoices
      </Link>

      <PageHeader
        title={data.number}
        numeric
        meta={
          <>
            <Pill variant={statusVariant(data.status)} dot>
              {statusLabel(data.status)}
            </Pill>
            {isProforma && <Pill variant="warn">Proforma</Pill>}
            {data.status === 'MATCH_EXCEPTION' && (
              <span className="text-micro font-semibold text-danger">
                Match exception
              </span>
            )}
          </>
        }
        description={
          <>
            <EntityRef kind="vendor" id={data.vendor.id}>
              {data.vendor.name}
            </EntityRef>{' '}
            {' — '}Ref <span className="font-numeric">{data.vendorInvoiceRef}</span>,
            source{' '}
            {data.source}
            {data.proformaRef && (
              <>
                {' '}
                · Replaces proforma{' '}
                <span className="font-numeric">{data.proformaRef}</span>
              </>
            )}
          </>
        }
      />

      {/* Stage strip */}
      <div className="mb-5 flex items-center gap-1 overflow-x-auto">
        {data.stages.map((s) => (
          <span
            key={s.key}
            className={
              'whitespace-nowrap rounded-xs px-2.5 py-1 text-caption font-medium ' +
              (s.state === 'done'
                ? 'bg-accent-wash text-accent-2'
                : s.state === 'active'
                  ? 'bg-ink text-white'
                  : 'bg-canvas text-faint')
            }
          >
            {s.label}
          </span>
        ))}
      </div>

      {isProforma && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn/30 bg-warn-wash px-4 py-3">
          <div className="min-w-0 text-caption text-warn">
            <div className="font-semibold">Proforma invoice (PI)</div>
            <div className="mt-0.5">
              {Number(data.amountPaid) > 0
                ? `The advance of ${inr(data.amountPaid)} is paid. The balance of ${inr(
                    data.amountOutstanding,
                  )} is blocked until the tax invoice is uploaded here.`
                : 'An advance can be paid against it. Anything after that waits for the tax invoice.'}
              {taxInvoiceWait && ` ${taxInvoiceWait}`}
            </div>
          </div>
          {(canIntake || canResolve) && (
            <Button
              variant="accent"
              size="sm"
              disabled={Boolean(taxInvoiceWait)}
              onClick={() => setAttachingTax(true)}
            >
              Upload tax invoice
            </Button>
          )}
        </div>
      )}
      {data.proformaRef && data.priorApproval && routable && (
        <div className="mb-5 rounded-lg border border-info/30 bg-info-wash px-4 py-3 text-caption text-info">
          The tax invoice replaced proforma{' '}
          <span className="font-numeric">{data.proformaRef}</span>
          {data.proformaGrossAmount && <> ({inr(data.proformaGrossAmount)})</>}, which
          was already approved. Once its exceptions are cleared, confirming it keeps that
          approval, unless the total went up, it is less than what has been paid, or it
          comes from a different supplier. Then it goes back to the approver.
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          {/* 3-way match */}
          <section>
            <h2 className="mb-2 text-body font-semibold text-ink">3-way match</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <MatchCard title="Purchase order" subtitle={data.po?.number ?? '—'}>
                {data.poLines.map((l) => (
                  <div key={l.id}>
                    <LineRow desc={l.itemDesc} qty={l.qtyOrdered} price={l.unitPrice} />
                    {/* Ordered quantity alone reads as headroom. Two invoices of
                        200 against an order for 1000 each look like a fifth of
                        it, and neither page mentions the other. */}
                    {Number(l.qtyInvoicedElsewhere) > 0 && (
                      <div className="mt-0.5 text-micro text-warn">
                        {l.qtyInvoicedElsewhere} already invoiced on{' '}
                        {data.relatedInvoices.length === 1
                          ? 'another invoice'
                          : `${data.relatedInvoices.length} other invoices`}{' '}
                      {`, ${remainingOn(l)} left`}
                      </div>
                    )}
                  </div>
                ))}
              </MatchCard>
              <MatchCard title="Goods receipt" subtitle={data.grn?.number ?? '—'}>
                <div className="text-caption text-muted">
                  QC: <span className="text-text">{data.grn?.qcStatus ?? '—'}</span>
                </div>
                <div className="mt-1 text-caption text-muted">
                  {data.grn
                    ? 'All ordered lines received.'
                    : 'No goods receipt yet — quantities cannot be verified.'}
                </div>
                {!data.grn && receivedNothing(data.poLines) && (
                  <div className="mt-1 text-micro text-warn">
                    Nothing has been received against this order.
                  </div>
                )}
              </MatchCard>
              <MatchCard title="Invoice" subtitle={data.vendorInvoiceRef} accent="danger">
                {data.lines.map((l) => (
                  <LineRow
                    key={l.id}
                    desc={l.itemDesc}
                    qty={l.qty}
                    price={l.unitPrice}
                    variance={l.hasVariance}
                  />
                ))}
              </MatchCard>
            </div>
          </section>

          {/* Exceptions */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-body font-semibold text-ink">
                Exceptions ({openExceptions.length} open
                {overridden.length > 0 && `, ${overridden.length} overridden`})
              </h2>
              {/*
                Hidden, not deleted. The match already re-runs on every event
                that moves its inputs: invoice creation, OCR completion,
                resolving an exception, releasing a hold, and — via
                `rematchLinkedInvoices` — posting a goods receipt against the
                PO. So there is nothing routine left for a person to trigger.

                It earned its keep once, unsticking two invoices whose exception
                came from a matcher bug rather than from their data. That is a
                deploy-time concern, not daily work, and a button that is only
                correct after a code change does not belong in an AP screen.

                Restore this block (and the two commented lines above) if a rule
                change ever needs re-evaluating in bulk again.

              {matched && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    runMatch.mutate(undefined, {
                      onSuccess: () => toast('Match re-run', 'success'),
                      onError: (e) =>
                        toast((e as Error).message || 'Could not re-run', 'error'),
                    })
                  }
                  disabled={runMatch.isPending}
                >
                  {runMatch.isPending ? 'Re-running…' : 'Re-run match'}
                </Button>
              )}
              */}
            </div>
            {data.suggestedResolution && (
              <div className="mb-3 rounded-sm bg-info-wash px-3 py-2 text-caption text-info">
                Suggested: {data.suggestedResolution}
              </div>
            )}
            {openExceptions.length === 0 &&
              (!PRE_MATCH.includes(data.status) ? (
                overridden.length > 0 ? (
                  // Not "all clear": a HIGH/CRITICAL was overridden by a human, not
                  // satisfied by the data. The approver is the one who has to weigh
                  // that, so name it instead of painting the section green.
                  <div className="rounded-sm border border-warn/30 bg-warn-wash px-3 py-2 text-caption text-warn">
                    No exceptions are open, but {overridden.length}{' '}
                    {overridden.length === 1 ? 'was' : 'were'} overridden rather than
                    cleared by matching data. Review the override reason below before
                    approving.
                  </div>
                ) : matched ? (
                  <div className="rounded-sm bg-accent-wash px-3 py-2 text-caption text-accent-2">
                    All exceptions resolved. Ready to route for approval.
                  </div>
                ) : null
              ) : (
                <div className="rounded-sm bg-info-wash px-3 py-2 text-caption text-info">
                  <div>
                    The 3-way match has not run yet ({statusLabel(data.status)}), so
                    nothing has been checked against the PO or the goods receipt.
                  </div>
                  {/* Without this an invoice whose extraction never completed is
                      simply stuck: the job is queued once at creation, the
                      matcher never runs, and routing refuses it forever. The
                      state was reachable and had no way out. */}
                  {retryable && (
                    <div className="mt-2 flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() =>
                          retryOcr.mutate(undefined, {
                            onSuccess: () =>
                              toast('Extraction queued — refresh in a moment', 'success'),
                            // Clicking and seeing nothing happen is worse than
                            // an error: the first attempt 403'd and the only
                            // trace was in the network tab.
                            onError: (e) =>
                              toast(
                                (e as Error).message || 'Could not queue extraction',
                                'error',
                              ),
                          })
                        }
                        disabled={retryOcr.isPending}
                      >
                        {retryOcr.isPending ? 'Queueing…' : 'Retry extraction'}
                      </Button>
                      <span className="text-micro text-muted">
                        Re-reads the attached document. Safe to run more than once.
                      </span>
                    </div>
                  )}
                </div>
              ))}
            <div className="flex flex-col gap-2">
              {currentExceptions.map((e) => (
                <div
                  key={e.id}
                  data-testid={`exc-${e.type}`}
                  className="flex items-center justify-between rounded-lg border border-line bg-panel p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {/* Green is for a variance accepted inside tolerance. An
                          overridden HIGH — "we skipped the goods-receipt check"
                          — is not a success, and painting it green is the same
                          reassuring-default failure as a sandbox CLEAR. */}
                      <Pill
                        variant={
                          !e.resolved
                            ? 'danger'
                            : e.severity === 'HIGH' || e.severity === 'CRITICAL'
                              ? 'warn'
                              : 'success'
                        }
                        dot
                      >
                        {exceptionLabel(e.type)}
                      </Pill>
                      {!e.resolved && (
                        <span className="text-micro font-semibold text-faint">
                          {e.severity}
                        </span>
                      )}
                      {/* Zero-impact control failures render nothing rather
                          than "+₹0.00", which reads as "no money at stake"
                          when the truth is "this was never priced". */}
                      {impactLabel(e.impactWithTax) && (
                        <span className="font-numeric text-caption text-danger">
                          {impactLabel(e.impactWithTax)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-caption text-muted">{e.message}</p>
                    {e.resolved && (
                      <div className="mt-1 text-micro">
                        <p
                          className={
                            e.severity === 'HIGH' || e.severity === 'CRITICAL'
                              ? 'font-medium text-warn'
                              : 'text-accent-2'
                          }
                        >
                          {e.severity === 'HIGH' || e.severity === 'CRITICAL'
                            ? `${e.severity} exception overridden`
                            : 'Resolved'}
                          {e.resolutionAction
                            ? `, ${e.resolutionAction.replace(/_/g, ' ').toLowerCase()}`
                            : ''}
                          {e.resolvedByName ? `, by ${e.resolvedByName}` : ''}
                          {e.resolvedAt
                            ? `, ${formatDate(e.resolvedAt)}`
                            : ''}
                        </p>
                        {e.resolutionNotes && (
                          <p className="mt-0.5 italic text-muted">
                            “{e.resolutionNotes}”
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {!e.resolved && (
                    <Button size="sm" variant="default" onClick={() => setResolving(e)}>
                      Resolve
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {proformaExceptions.length > 0 && (
              <details className="mt-3 text-caption">
                <summary className="cursor-pointer text-muted">
                  {proformaExceptions.length} raised on proforma {data.proformaRef} (no
                  longer apply)
                </summary>
                <ul className="mt-2 flex flex-col gap-1.5 border-l border-line pl-4 text-muted">
                  {proformaExceptions.map((e) => (
                    <li key={e.id}>
                      <span className="font-medium text-text">{exceptionLabel(e.type)}</span>
                      {' · '}
                      {e.resolved
                        ? `overridden${e.resolvedByName ? ` by ${e.resolvedByName}` : ''}`
                        : 'was open'}
                      {' · '}
                      {e.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {/* Approval routing — live (Slice 2) */}
          <section>
            <h2 className="mb-2 text-body font-semibold text-ink">Approval routing</h2>
            <div className="flex flex-wrap items-center gap-2">
              {data.liveApprovalChain.map((s) => (
                <span
                  key={`${s.stepNo}-${s.approvalId ?? s.approverId ?? s.stepNo}`}
                  className={
                    'flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-caption ' +
                    (s.isCurrent
                      ? 'border-accent bg-accent-wash'
                      : s.decision === 'APPROVED'
                        ? 'border-line bg-panel'
                        : s.decision === 'REJECTED'
                          ? 'border-danger/40 bg-danger-wash'
                          : 'border-line bg-panel')
                  }
                >
                  <span className="font-numeric flex h-5 w-5 items-center justify-center rounded-full bg-canvas text-micro">
                    {s.stepNo}
                  </span>
                  <span className="font-medium text-text">
                    {s.approverName ?? s.role.replace(/_/g, ' ')}
                  </span>
                  <Pill
                    variant={
                      s.decision === 'APPROVED'
                        ? 'success'
                        : s.decision === 'REJECTED'
                          ? 'danger'
                          : s.slaStatus === 'breach'
                            ? 'danger'
                            : s.slaStatus === 'warn'
                              ? 'warn'
                              : 'gray'
                    }
                    dot
                  >
                    {s.decision === 'PENDING'
                      ? s.isCurrent
                        ? 'Current'
                        : 'Pending'
                      : s.decision.replace(/_/g, ' ')}
                  </Pill>
                  {s.isEscalation && (
                    <span className="text-micro font-semibold text-warn">ESC</span>
                  )}
                  {s.delegatedFromName && (
                    <span className="text-micro text-violet">
                      via {s.delegatedFromName}
                    </span>
                  )}
                </span>
              ))}
              {data.liveApprovalChain.length === 0 && (
                <span className="text-caption text-muted">
                  No approval steps for this amount.
                </span>
              )}
            </div>
          </section>

          {/* Activity + payments + comments */}
          <section>
            <SubNav
              className="mb-2"
              aria-label="Invoice history"
              items={[
                { key: 'activity', label: 'Activity' },
                { key: 'payments', label: 'Payments' },
              ]}
              value={activityTab}
              onChange={(k) => setActivityTab(k as 'activity' | 'payments')}
            />
            {activityTab === 'activity' ? (
              <ul className="mb-3 flex flex-col gap-1.5 border-l border-line pl-4">
                {data.activity.map((a) => (
                  <li key={a.id} className="text-caption text-muted">
                    <span className="font-medium text-text">
                      {a.action.replace(/_/g, ' ')}
                    </span>{' '}
                    ,{' '}
                    <span className="font-numeric">
                      {formatDateTime(a.at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mb-3 flex flex-col gap-2">
                {data.payments.length > 0 ? (
                  data.payments.map((p) => <PaymentCard key={p.id} payment={p} />)
                ) : (
                  <div className="text-caption text-muted">
                    Not yet paid. Payments appear here once a run is confirmed by the
                    bank, or when a payment made outside a run is recorded.
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add an internal comment…"
                className="flex-1 rounded-sm border border-line bg-panel px-3 py-2 text-body-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <Button
                size="sm"
                variant="default"
                disabled={!comment.trim() || addComment.isPending}
                onClick={() =>
                  addComment.mutate(comment, {
                    onSuccess: () => {
                      setComment('');
                      toast('Comment added', 'success');
                    },
                  })
                }
              >
                Comment
              </Button>
            </div>
          </section>
        </div>

        {/* Right panel */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="text-micro text-faint">
              Amount payable
            </div>
            <div className="font-numeric mt-1 text-h1 font-semibold tracking-display text-ink">
              {inr(data.amounts.grossAmount)}
            </div>
            <dl className="mt-3 flex flex-col gap-1 text-caption">
              <Row
                label={`Taxable (${data.amounts.taxKind})`}
                value={inr(data.amounts.subtotal)}
              />
              <Row label="Tax" value={inr(data.amounts.taxAmount)} />
              <Row label="TDS 194Q" value={`- ${inr(data.amounts.tdsAmount)}`} />
              <div className="my-1 border-t border-line" />
              <Row label="Net payable" value={inr(data.amounts.netPayable)} strong />
              {partlyPaid && (
                <>
                  <Row label="Paid so far" value={`- ${inr(data.amountPaid)}`} />
                  <Row label="Outstanding" value={inr(data.amountOutstanding)} strong />
                </>
              )}
            </dl>
            {data.paymentBlockedReason && (
              <p className="mt-3 rounded-sm bg-warn-wash px-2.5 py-2 text-micro text-warn">
                {data.paymentBlockedReason}
              </p>
            )}
            {data.activePaymentRun ? (
              <p className="mt-3 text-micro text-muted">
                In payment run{' '}
                <Link
                  href={`/payment-runs/${data.activePaymentRun.id}`}
                  className="font-numeric text-accent-2"
                >
                  {data.activePaymentRun.number}
                </Link>
                . Change what it pays there.
              </p>
            ) : (
              payable &&
              canPay && (
                <Button
                  variant="default"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setRecording(true)}
                >
                  Record payment
                </Button>
              )
            )}
          </div>

          {data.payment && (
            <div className="rounded-lg border border-accent/30 bg-accent-wash p-4">
              <div className="flex items-center justify-between">
                <span className="text-caption font-semibold text-accent-2">Payment</span>
                {data.payment.isStub && <Pill variant="warn">Stub UTR</Pill>}
              </div>
              <div className="font-numeric mt-1 text-body-sm text-ink">
                {data.payment.utr}
              </div>
              {data.payment.paymentRunId ? (
                <Link
                  href={`/payment-runs/${data.payment.paymentRunId}`}
                  className="mt-1 inline-block text-micro text-accent-2"
                >
                  {data.payment.paymentRunNumber} →
                </Link>
              ) : (
                <div className="mt-1 text-micro text-accent-2">Recorded manually</div>
              )}
              {data.payments.length > 1 && (
                <div className="mt-1 text-micro text-muted">
                  {data.payments.length} payments — see the Payments tab
                </div>
              )}
            </div>
          )}

          {data.msme && data.msme.bucket !== 'SAFE' && (
            <div className="rounded-lg border border-danger/30 bg-danger-wash p-4">
              <div className="flex items-center justify-between">
                <span className="text-caption font-semibold text-danger">
                  MSME §15 clock
                </span>
                <Pill variant={msmeVariant(data.msme.bucket)} dot>
                  {data.msme.daysRemaining} days left
                </Pill>
              </div>
              <p className="mt-1 text-micro text-danger/80">
                Due {formatDate(data.msme.dueDate)}. Pay within
                the 45-day cap to avoid interest.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 text-micro text-faint">
              Compliance
            </div>
            {isProforma && (
              <p className="mb-2 text-micro text-muted">
                A proforma is not a GST document, so it is not reconciled against
                GSTR-2B. The tax invoice will be.
              </p>
            )}
            <dl className="flex flex-col gap-1.5 text-caption">
              <Row
                label="GSTIN"
                value={
                  <VerificationResult
                    status={complianceLabel(data.compliance.gstinStatus)}
                    variant={complianceVariant(data.compliance.gstinStatus)}
                    simulated={isSimulated(COMPLIANCE_PROVIDER.gstin)}
                    label="GSTIN status check"
                  />
                }
              />
              <Row
                label="GSTR-2B"
                value={
                  <VerificationResult
                    status={complianceLabel(data.compliance.gstr2bStatus)}
                    variant={complianceVariant(data.compliance.gstr2bStatus)}
                    simulated={isSimulated(COMPLIANCE_PROVIDER.gstr2b)}
                    label="GSTR-2B reconciliation"
                  />
                }
              />
              <Row
                label="IRN"
                value={
                  data.compliance.irn ? (
                    <VerificationResult
                      status="Present"
                      variant="success"
                      simulated={isSimulated(COMPLIANCE_PROVIDER.irn)}
                      label="e-invoice IRN validation"
                    />
                  ) : (
                    '—'
                  )
                }
              />
              <Row label="e-Way bill" value={data.compliance.ewaybillNo ?? '—'} />
            </dl>
          </div>

          {/* Its own panel rather than a line in Linked documents: being told
              other invoices exist and being unable to see which is the gap this
              closes, and a reviewer deciding on an amount should not have to
              open the PO to find the competing claims. */}
          {data.relatedInvoices.length > 0 && (
            <div className="rounded-lg border border-warn/30 bg-panel p-4">
              <div className="mb-2 text-micro text-faint">
                Also invoiced against {data.po?.number ?? 'this PO'}
              </div>
              <div className="flex flex-col gap-2">
                {data.relatedInvoices.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <EntityRef kind="invoice" id={r.id}>
                        {r.number}
                      </EntityRef>
                      <div className="truncate text-micro text-faint">
                        {r.vendorInvoiceRef} ,{' '}
                        {formatDate(r.invoiceDate)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-numeric text-caption text-text">
                        {inr(r.grossAmount)}
                      </div>
                      <Pill variant={statusVariant(r.status)}>
                        {statusLabel(r.status)}
                      </Pill>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 text-micro text-faint">
              Linked documents
            </div>
            <div className="flex flex-col gap-1.5 text-caption">
              {data.po && (
                <EntityRef kind="po" id={data.po.id}>
                  {data.po.number}
                </EntityRef>
              )}
              {data.grn && (
                <EntityRef kind="grn" id={data.grn.id}>
                  {data.grn.number}
                </EntityRef>
              )}
              {data.attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-2"
                >
                  {attachmentLabel(a.docType, isProforma)}
                </a>
              ))}
            </div>
            {/* Only until a tax invoice has replaced a PI: after that the
                record holds a real tax invoice and the answer is settled. */}
            {canResolve && !data.proformaRef && data.status !== 'REJECTED' && (
              <button
                type="button"
                disabled={setKind.isPending}
                onClick={() =>
                  setKind.mutate(isProforma ? 'TAX_INVOICE' : 'PROFORMA', {
                    onSuccess: () =>
                      toast(
                        isProforma ? 'Marked as a tax invoice' : 'Marked as a proforma',
                        'success',
                      ),
                    onError: (e) => toast((e as Error).message, 'error'),
                  })
                }
                className="mt-3 text-micro text-muted underline decoration-dotted hover:text-text"
              >
                {isProforma
                  ? 'This is actually a tax invoice'
                  : 'The attachment is a proforma (PI)'}
              </button>
            )}
          </div>

          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 text-micro text-faint">
              Vendor snapshot
            </div>
            <div className="text-body-sm font-medium text-ink">{data.vendor.name}</div>
            <dl className="mt-1 flex flex-col gap-1 text-caption">
              <Row label="Risk score" value={`A, ${data.vendor.riskScore ?? '—'}`} />
              <Row label="FYTD spend" value={inrCompact(data.vendor.fytdSpend)} />
              <Row label="On-time" value={`${data.vendor.onTimePct ?? '—'}%`} />
            </dl>
          </div>

          {/* The trust column. Same position on every document detail page. */}
          <DocumentLedger entityId={data.id} />
        </aside>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3">
          {data.status === 'AWAITING_APPROVAL' ? (
            data.canDecide ? (
              <>
                <input
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder="Add a decision comment…"
                  className="flex-1 rounded-sm border border-line bg-panel px-3 py-2 text-body-sm outline-none"
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
              <div
                className="ml-auto text-body-sm text-muted"
                title="Waiting for the current approver"
              >
                Waiting for{' '}
                {data.liveApprovalChain.find((s) => s.isCurrent)?.approverName ??
                  'the current approver'}
              </div>
            )
          ) : routable ? (
            <Button
              variant="primary"
              className="ml-auto"
              onClick={onRoute}
              disabled={route.isPending || openExceptions.length > 0 || !matched}
              title={
                matched ? undefined : 'The 3-way match has not run on this invoice yet'
              }
            >
              {data.priorApproval ? 'Confirm tax invoice' : 'Resolve & route for approval'}
            </Button>
          ) : null}
        </div>
      </div>

      <ResolveModal
        invoiceId={id}
        exception={resolving}
        onClose={() => setResolving(null)}
      />
      <Dialog open={attachingTax} onOpenChange={(o) => !o && setAttachingTax(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogTitle>Upload tax invoice</DialogTitle>
          <DialogDescription>
            Replaces proforma {data.vendorInvoiceRef} on {data.number}. The proforma stays
            attached, payments already made stay recorded, and the tax invoice goes
            through OCR and the 3-way match again.
          </DialogDescription>
          <div className="mt-4">
            {attachingTax && (
              <TaxInvoiceForm
                proformaRef={data.vendorInvoiceRef}
                proformaTotal={data.amounts.grossAmount}
                seedLines={data.lines}
                pending={attachTax.isPending}
                onCancel={() => setAttachingTax(false)}
                onSubmit={(file, body) =>
                  attachTax.mutate(
                    { file, body },
                    {
                      onSuccess: () => {
                        setAttachingTax(false);
                        toast('Tax invoice uploaded. Reading it now.', 'success');
                      },
                      onError: (e) =>
                        toast(
                          (e as Error).message || 'Could not upload the tax invoice',
                          'error',
                        ),
                    },
                  )
                }
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Mounted only while open, so it starts from the current balance. */}
      {recording && (
        <RecordPaymentModal
          open
          invoiceId={id}
          invoiceNumber={data.number}
          grossAmount={data.amounts.grossAmount}
          outstanding={data.amountOutstanding}
          remainingTds={remainingTds}
          onClose={() => setRecording(false)}
        />
      )}
    </div>
  );
}

function PaymentCard({ payment: p }: { payment: InvoicePaymentInfo }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-panel p-3 text-caption">
      <div className="flex items-center justify-between">
        {p.paymentRunId ? (
          <Link
            href={`/payment-runs/${p.paymentRunId}`}
            className="font-numeric font-medium text-accent-2"
          >
            {p.paymentRunNumber}
          </Link>
        ) : (
          <span className="font-medium text-text">
            Recorded manually{p.mode ? ` · ${p.mode}` : ''}
          </span>
        )}
        {p.isStub && <Pill variant="warn">Stub UTR</Pill>}
      </div>
      <dl className="mt-2 flex flex-col gap-1">
        <Row label={p.mode === 'CHEQUE' ? 'Cheque no.' : 'UTR'} value={p.utr} />
        <Row label="Settled" value={inr(p.gross)} />
        {Number(p.tds) > 0 && <Row label="TDS withheld" value={inr(p.tds)} />}
        <Row label="Net paid" value={inr(p.net)} />
        <Row label="Paid on" value={new Date(p.paidAt).toLocaleDateString('en-IN')} />
        {p.recordedByName && <Row label="Recorded by" value={p.recordedByName} />}
      </dl>
      {p.note && <p className="mt-1.5 italic text-muted">“{p.note}”</p>}
    </div>
  );
}

function MatchCard({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  accent?: 'danger';
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className={
        'rounded-lg border bg-panel p-3 ' +
        (accent === 'danger' ? 'border-danger/40' : 'border-line')
      }
    >
      <div className="text-caption font-semibold text-ink">{title}</div>
      <div className="font-numeric mb-2 text-micro text-faint">{subtitle}</div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function LineRow({
  desc,
  qty,
  price,
  variance,
}: {
  desc: string;
  qty: string;
  price: string;
  variance?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={
        'flex items-center justify-between rounded-sm px-1.5 py-1 text-caption ' +
        (variance ? 'bg-danger-wash text-danger' : 'text-text')
      }
    >
      <span className="truncate pr-2">{desc}</span>
      <span className="font-numeric shrink-0">
        {qty} × {inr(price, 0)}
      </span>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}): React.JSX.Element {
  // Plain values are figures, IDs and dates, so they take the mono face. A
  // rendered node (a pill, a sandbox chip) brings its own typography and must
  // not inherit it.
  const isText = typeof value === 'string' || typeof value === 'number';
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd
        className={
          (isText ? 'font-numeric text-right ' : '') +
          (strong ? 'font-semibold text-ink' : 'text-text')
        }
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Colour for a compliance verdict string. Only clearly-good and clearly-bad
 * states get a colour; anything unrecognised stays neutral rather than being
 * guessed into green.
 */
/** Ordered, less everything other live invoices have already claimed. */
function remainingOn(l: { qtyOrdered: string; qtyInvoicedElsewhere: string }): string {
  const left = Number(l.qtyOrdered) - Number(l.qtyInvoicedElsewhere);
  return String(Math.max(left, 0));
}

/**
 * Nothing received on any line. Distinct from "no GRN document": a receipt can
 * exist and be empty, and the reviewer is being asked to approve payment for
 * goods, so the quantity is the fact that matters.
 */
function receivedNothing(poLines: { qtyReceived: string }[]): boolean {
  return poLines.length > 0 && poLines.every((l) => Number(l.qtyReceived) <= 0);
}

/**
 * Statuses where the document has not been read and matched yet. Only here
 * does "no exceptions" mean "nothing was checked"; past approval it means the
 * match ran and was cleared, and saying otherwise misleads the reviewer.
 */
const PRE_MATCH = [
  'RECEIVED',
  'OCR_PENDING',
  'OCR_FAILED',
  'OCR_LOW_CONFIDENCE',
  'PENDING_VENDOR_MATCH',
];

/** Statuses before approval, where routing (or confirming a tax invoice) applies. */
const PRE_APPROVAL = ['RECEIVED', 'OCR_DONE', 'MATCH_EXCEPTION'];

/** Where a proforma cannot take its tax invoice yet. Mirrors the API. */
const TAX_INVOICE_WAIT: Record<string, string> = {
  OCR_PENDING: 'Wait for the proforma to finish being read first.',
  AWAITING_APPROVAL: 'Wait for the approver to decide first.',
  SCHEDULED: 'Wait for the payment run holding it to settle first.',
  HELD: 'Release the hold first.',
  REJECTED: 'It was rejected. Submit the tax invoice as a new invoice.',
};

function attachmentLabel(docType: string, isProforma: boolean): string {
  if (docType === 'PROFORMA_PDF') return 'Proforma (PDF, replaced)';
  if (docType === 'INVOICE_PDF') return isProforma ? 'Proforma (PDF)' : 'Tax invoice (PDF)';
  if (docType === 'EMAIL_BODY') return 'Original email';
  return 'Attachment';
}

function complianceVariant(status: string): 'success' | 'danger' | 'warn' | 'neutral' {
  const s = status.toUpperCase();
  if (['ACTIVE', 'MATCHED', 'VALID', 'CLEAR', 'FOUND'].includes(s)) return 'success';
  if (['CANCELLED', 'SUSPENDED', 'INVALID', 'NOT_FOUND', 'MISMATCH'].includes(s)) {
    return 'danger';
  }
  // Not-yet-checked is not a warning. Nothing is wrong with the invoice; the
  // check simply has not run, and colouring it amber sent reviewers hunting
  // for a problem that did not exist.
  return 'neutral';
}

/**
 * Compliance verdicts in words.
 *
 * The GSP returns machine enums — `NOT_CHECKED`, `NOT_APPLICABLE`, `MISMATCH`
 * — and they were rendered straight onto the reviewer's screen. A person
 * approving a payment should not have to decode a constant name, and
 * `NOT_CHECKED` in particular reads as a system defect rather than as "we have
 * not asked the portal yet".
 */
const COMPLIANCE_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  MATCHED: 'Matched',
  VALID: 'Valid',
  CLEAR: 'Clear',
  FOUND: 'Found',
  CANCELLED: 'Cancelled',
  SUSPENDED: 'Suspended',
  INVALID: 'Invalid',
  NOT_FOUND: 'Not found',
  MISMATCH: 'Does not match',
  PENDING: 'Check in progress',
  NOT_CHECKED: 'Not checked yet',
  UNKNOWN: 'No answer from the portal',
  NOT_APPLICABLE: 'Not applicable',
};

function complianceLabel(status: string): string {
  const s = status.toUpperCase();
  return COMPLIANCE_LABELS[s] ?? status;
}
