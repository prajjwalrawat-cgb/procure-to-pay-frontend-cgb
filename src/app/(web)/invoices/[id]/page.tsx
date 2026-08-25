'use client';

import { Button, PageHeader, Pill, VerificationResult } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { InvoiceExceptionView } from '@/lib/shared';

import { DocumentLedger } from '@/components/document-ledger';
import { EntityRef } from '@/components/entity-ref';
import { ResolveModal } from '@/components/invoices/resolve-modal';
import { useDecide } from '@/lib/api/inbox';
import { useAddComment, useInvoice, useResolveAndRoute } from '@/lib/api/invoices';
import { exceptionLabel, impactLabel } from '@/lib/exception-display';
import { inr, inrCompact, msmeVariant, statusLabel, statusVariant } from '@/lib/format';
import { COMPLIANCE_PROVIDER, useProviderLiveness } from '@/lib/integration-status';
import { useToastStore } from '@/store/toast-store';

export default function InvoiceDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { data, isLoading } = useInvoice(id);
  const route = useResolveAndRoute(id);
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

  if (isLoading || !data) {
    return <div className="p-6 text-[13px] text-muted">Loading invoice…</div>;
  }

  const openExceptions = data.exceptions.filter((e) => !e.resolved);
  // An exception someone waved through is not the same as one that never
  // fired. "0 open" reads identically for a clean match and for an overridden
  // HIGH GRN_MISSING, so overrides are counted and shown separately.
  const overridden = data.exceptions.filter(
    (e) => e.resolved && (e.severity === 'HIGH' || e.severity === 'CRITICAL'),
  );
  // An empty exception list means "clean match" only once a match has run. While
  // OCR is pending or has failed, the matcher has never looked at this invoice,
  // so zero exceptions says nothing — and routing on it would send an unmatched
  // invoice into the approval chain. These are the states the matcher leaves.
  const matched = data.status === 'OCR_DONE' || data.status === 'MATCH_EXCEPTION';

  const onRoute = (): void => {
    route.mutate(undefined, {
      onSuccess: () => {
        toast('Routed for approval', 'success');
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
    <div className="mx-auto max-w-6xl pb-20">
      <Link
        href="/invoices"
        className="mb-3 inline-flex items-center gap-1 text-[12px] text-muted"
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
            {data.status === 'MATCH_EXCEPTION' && (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-danger">
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
            · Ref <span className="font-numeric">{data.vendorInvoiceRef}</span> · Source{' '}
            {data.source}
          </>
        }
      />

      {/* Stage strip */}
      <div className="mb-5 flex items-center gap-1 overflow-x-auto">
        {data.stages.map((s) => (
          <span
            key={s.key}
            className={
              'whitespace-nowrap rounded-xs px-2.5 py-1 text-[12px] font-medium ' +
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

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          {/* 3-way match */}
          <section>
            <h2 className="mb-2 text-[14px] font-semibold text-ink">3-way match</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <MatchCard title="Purchase order" subtitle={data.po?.number ?? '—'}>
                {data.poLines.map((l) => (
                  <LineRow
                    key={l.id}
                    desc={l.itemDesc}
                    qty={l.qtyOrdered}
                    price={l.unitPrice}
                  />
                ))}
              </MatchCard>
              <MatchCard title="Goods receipt" subtitle={data.grn?.number ?? '—'}>
                <div className="text-[12px] text-muted">
                  QC: <span className="text-text">{data.grn?.qcStatus ?? '—'}</span>
                </div>
                <div className="mt-1 text-[12px] text-muted">
                  {data.grn
                    ? 'All ordered lines received.'
                    : 'No goods receipt yet — quantities cannot be verified.'}
                </div>
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
              <h2 className="text-[14px] font-semibold text-ink">
                Exceptions ({openExceptions.length} open
                {overridden.length > 0 && ` · ${overridden.length} overridden`})
              </h2>
            </div>
            {data.suggestedResolution && (
              <div className="mb-3 rounded-sm bg-info-wash px-3 py-2 text-[12px] text-info">
                Suggested: {data.suggestedResolution}
              </div>
            )}
            {openExceptions.length === 0 &&
              (matched ? (
                overridden.length > 0 ? (
                  // Not "all clear": a HIGH/CRITICAL was overridden by a human, not
                  // satisfied by the data. The approver is the one who has to weigh
                  // that, so name it instead of painting the section green.
                  <div className="rounded-sm border border-warn/30 bg-warn-wash px-3 py-2 text-[12px] text-warn">
                    No exceptions are open, but {overridden.length}{' '}
                    {overridden.length === 1 ? 'was' : 'were'} overridden rather than
                    cleared by matching data. Review the override reason below before
                    approving.
                  </div>
                ) : (
                  <div className="rounded-sm bg-accent-wash px-3 py-2 text-[12px] text-accent-2">
                    All exceptions resolved. Ready to route for approval.
                  </div>
                )
              ) : (
                <div className="rounded-sm bg-info-wash px-3 py-2 text-[12px] text-info">
                  The 3-way match has not run yet ({statusLabel(data.status)}), so nothing
                  has been checked against the PO or the goods receipt.
                </div>
              ))}
            <div className="flex flex-col gap-2">
              {data.exceptions.map((e) => (
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
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                          {e.severity}
                        </span>
                      )}
                      {/* Zero-impact control failures render nothing rather
                          than "+₹0.00", which reads as "no money at stake"
                          when the truth is "this was never priced". */}
                      {impactLabel(e.impactWithTax) && (
                        <span className="font-numeric text-[12px] text-danger">
                          {impactLabel(e.impactWithTax)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] text-muted">{e.message}</p>
                    {e.resolved && (
                      <div className="mt-1 text-[11px]">
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
                            ? ` · ${e.resolutionAction.replace(/_/g, ' ').toLowerCase()}`
                            : ''}
                          {e.resolvedByName ? ` · by ${e.resolvedByName}` : ''}
                          {e.resolvedAt
                            ? ` · ${new Date(e.resolvedAt).toLocaleDateString('en-IN')}`
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
          </section>

          {/* Approval routing — live (Slice 2) */}
          <section>
            <h2 className="mb-2 text-[14px] font-semibold text-ink">Approval routing</h2>
            <div className="flex flex-wrap items-center gap-2">
              {data.liveApprovalChain.map((s) => (
                <span
                  key={`${s.stepNo}-${s.approvalId ?? s.approverId ?? s.stepNo}`}
                  className={
                    'flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-[12px] ' +
                    (s.isCurrent
                      ? 'border-accent bg-accent-wash'
                      : s.decision === 'APPROVED'
                        ? 'border-line bg-panel'
                        : s.decision === 'REJECTED'
                          ? 'border-danger/40 bg-danger-wash'
                          : 'border-line bg-panel')
                  }
                >
                  <span className="font-numeric flex h-5 w-5 items-center justify-center rounded-full bg-canvas text-[10px]">
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
                    <span className="text-[10px] font-semibold text-warn">ESC</span>
                  )}
                  {s.delegatedFromName && (
                    <span className="text-[10px] text-violet">
                      via {s.delegatedFromName}
                    </span>
                  )}
                </span>
              ))}
              {data.liveApprovalChain.length === 0 && (
                <span className="text-[12px] text-muted">
                  No approval steps for this amount.
                </span>
              )}
            </div>
          </section>

          {/* Activity + payments + comments */}
          <section>
            <div className="mb-2 flex items-center gap-1 border-b border-line">
              {(['activity', 'payments'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActivityTab(t)}
                  className={
                    'border-b-2 px-3 py-1.5 text-[13px] font-medium capitalize ' +
                    (activityTab === t
                      ? 'border-accent text-ink'
                      : 'border-transparent text-muted hover:text-text')
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            {activityTab === 'activity' ? (
              <ul className="mb-3 flex flex-col gap-1.5 border-l border-line pl-4">
                {data.activity.map((a) => (
                  <li key={a.id} className="text-[12px] text-muted">
                    <span className="font-medium text-text">
                      {a.action.replace(/_/g, ' ')}
                    </span>{' '}
                    ·{' '}
                    <span className="font-numeric">
                      {new Date(a.at).toLocaleString('en-IN')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mb-3">
                {data.payment ? (
                  <div className="rounded-lg border border-line bg-panel p-3 text-[12px]">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/payment-runs/${data.payment.paymentRunId}`}
                        className="font-numeric font-medium text-accent-2"
                      >
                        {data.payment.paymentRunNumber}
                      </Link>
                      {data.payment.isStub && <Pill variant="warn">Stub UTR</Pill>}
                    </div>
                    <dl className="mt-2 flex flex-col gap-1">
                      <Row label="UTR" value={data.payment.utr} />
                      <Row label="Net paid" value={inr(data.payment.net)} />
                      <Row
                        label="Paid on"
                        value={new Date(data.payment.paidAt).toLocaleString('en-IN')}
                      />
                    </dl>
                  </div>
                ) : (
                  <div className="text-[12px] text-muted">
                    Not yet paid. Payments appear here once a run is submitted.
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add an internal comment…"
                className="flex-1 rounded-sm border border-line bg-panel px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
            <div className="text-[11px] uppercase tracking-wide text-faint">
              Amount payable
            </div>
            <div className="font-numeric mt-1 text-[22px] font-semibold tracking-display text-ink">
              {inr(data.amounts.grossAmount)}
            </div>
            <dl className="mt-3 flex flex-col gap-1 text-[12px]">
              <Row
                label={`Taxable (${data.amounts.taxKind})`}
                value={inr(data.amounts.subtotal)}
              />
              <Row label="Tax" value={inr(data.amounts.taxAmount)} />
              <Row label="TDS 194Q" value={`- ${inr(data.amounts.tdsAmount)}`} />
              <div className="my-1 border-t border-line" />
              <Row label="Net payable" value={inr(data.amounts.netPayable)} strong />
            </dl>
          </div>

          {data.payment && (
            <div className="rounded-lg border border-accent/30 bg-accent-wash p-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-accent-2">Payment</span>
                {data.payment.isStub && <Pill variant="warn">Stub UTR</Pill>}
              </div>
              <div className="font-numeric mt-1 text-[13px] text-ink">
                {data.payment.utr}
              </div>
              <Link
                href={`/payment-runs/${data.payment.paymentRunId}`}
                className="mt-1 inline-block text-[11px] text-accent-2"
              >
                {data.payment.paymentRunNumber} →
              </Link>
            </div>
          )}

          {data.msme && data.msme.bucket !== 'SAFE' && (
            <div className="rounded-lg border border-danger/30 bg-danger-wash p-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-danger">
                  MSME §15 clock
                </span>
                <Pill variant={msmeVariant(data.msme.bucket)} dot>
                  {data.msme.daysRemaining} days left
                </Pill>
              </div>
              <p className="mt-1 text-[11px] text-danger/80">
                Due {new Date(data.msme.dueDate).toLocaleDateString('en-IN')}. Pay within
                the 45-day cap to avoid interest.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-faint">
              Compliance
            </div>
            <dl className="flex flex-col gap-1.5 text-[12px]">
              <Row
                label="GSTIN"
                value={
                  <VerificationResult
                    status={data.compliance.gstinStatus}
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
                    status={data.compliance.gstr2bStatus}
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

          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-faint">
              Linked documents
            </div>
            <div className="flex flex-col gap-1.5 text-[12px]">
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
                  Attachment (PDF)
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-faint">
              Vendor snapshot
            </div>
            <div className="text-[13px] font-medium text-ink">{data.vendor.name}</div>
            <dl className="mt-1 flex flex-col gap-1 text-[12px]">
              <Row label="Risk score" value={`A · ${data.vendor.riskScore ?? '—'}`} />
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
                  className="flex-1 rounded-sm border border-line bg-panel px-3 py-2 text-[13px] outline-none"
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
                    variant="accent"
                    disabled={decide.isPending}
                    onClick={() => onDecide('APPROVE')}
                  >
                    Approve
                  </Button>
                </div>
              </>
            ) : (
              <div
                className="ml-auto text-[13px] text-muted"
                title="Waiting for the current approver"
              >
                Waiting for{' '}
                {data.liveApprovalChain.find((s) => s.isCurrent)?.approverName ??
                  'the current approver'}
              </div>
            )
          ) : (
            <Button
              variant="accent"
              className="ml-auto"
              onClick={onRoute}
              disabled={route.isPending || openExceptions.length > 0 || !matched}
              title={
                matched ? undefined : 'The 3-way match has not run on this invoice yet'
              }
            >
              Resolve &amp; route for approval
            </Button>
          )}
        </div>
      </div>

      <ResolveModal
        invoiceId={id}
        exception={resolving}
        onClose={() => setResolving(null)}
      />
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
      <div className="text-[12px] font-semibold text-ink">{title}</div>
      <div className="font-numeric mb-2 text-[11px] text-faint">{subtitle}</div>
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
        'flex items-center justify-between rounded-sm px-1.5 py-1 text-[12px] ' +
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
function complianceVariant(status: string): 'success' | 'danger' | 'warn' | 'gray' {
  const s = status.toUpperCase();
  if (['ACTIVE', 'MATCHED', 'VALID', 'CLEAR', 'FOUND'].includes(s)) return 'success';
  if (['CANCELLED', 'SUSPENDED', 'INVALID', 'NOT_FOUND', 'MISMATCH'].includes(s)) {
    return 'danger';
  }
  if (['PENDING', 'NOT_CHECKED', 'UNKNOWN', 'NOT_APPLICABLE'].includes(s)) return 'warn';
  return 'gray';
}
