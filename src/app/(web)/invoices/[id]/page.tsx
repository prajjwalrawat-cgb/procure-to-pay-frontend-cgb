'use client';

import { Button, Pill } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { InvoiceExceptionView } from '@/lib/shared';

import { EntityRef } from '@/components/entity-ref';
import { ResolveModal } from '@/components/invoices/resolve-modal';
import { useDecide } from '@/lib/api/inbox';
import { useAddComment, useInvoice, useResolveAndRoute } from '@/lib/api/invoices';
import { inr, inrCompact, msmeVariant, statusLabel, statusVariant } from '@/lib/format';
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

  if (isLoading || !data) {
    return <div className="text-muted p-6 text-[13px]">Loading invoice…</div>;
  }

  const openExceptions = data.exceptions.filter((e) => !e.resolved);

  const onRoute = (): void => {
    route.mutate(undefined, {
      onSuccess: () => {
        toast('Routed for approval', 'success');
        router.push('/invoices');
      },
      onError: () => toast('Resolve all exceptions before routing', 'error'),
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
        className="text-muted mb-3 inline-flex items-center gap-1 text-[12px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to invoices
      </Link>

      <div className="mb-4 flex items-start justify-between">
        <div>
          {data.status === 'MATCH_EXCEPTION' && (
            <span className="text-danger text-[11px] font-semibold uppercase tracking-wide">
              Match exception
            </span>
          )}
          <h1 className="tracking-heading text-ink flex items-center gap-2 text-[20px] font-semibold">
            <span className="font-numeric">{data.number}</span>
            <Pill variant={statusVariant(data.status)} dot>
              {statusLabel(data.status)}
            </Pill>
          </h1>
          <p className="text-muted text-[13px]">
            <EntityRef kind="vendor" id={data.vendor.id}>
              {data.vendor.name}
            </EntityRef>{' '}
            · Ref <span className="font-numeric">{data.vendorInvoiceRef}</span> · Source{' '}
            {data.source}
          </p>
        </div>
      </div>

      {/* Stage strip */}
      <div className="mb-5 flex items-center gap-1 overflow-x-auto">
        {data.stages.map((s) => (
          <span
            key={s.key}
            className={
              'rounded-xs whitespace-nowrap px-2.5 py-1 text-[12px] font-medium ' +
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

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          {/* 3-way match */}
          <section>
            <h2 className="text-ink mb-2 text-[14px] font-semibold">3-way match</h2>
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
                <div className="text-muted text-[12px]">
                  QC: <span className="text-text">{data.grn?.qcStatus ?? '—'}</span>
                </div>
                <div className="text-muted mt-1 text-[12px]">
                  All ordered lines received.
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
              <h2 className="text-ink text-[14px] font-semibold">
                Exceptions ({openExceptions.length} open)
              </h2>
            </div>
            {data.suggestedResolution && (
              <div className="bg-info-wash text-info mb-3 rounded-sm px-3 py-2 text-[12px]">
                Suggested: {data.suggestedResolution}
              </div>
            )}
            {openExceptions.length === 0 && (
              <div className="bg-accent-wash text-accent-2 rounded-sm px-3 py-2 text-[12px]">
                All exceptions resolved. Ready to route for approval.
              </div>
            )}
            <div className="flex flex-col gap-2">
              {data.exceptions.map((e) => (
                <div
                  key={e.id}
                  data-testid={`exc-${e.type}`}
                  className="border-line bg-panel flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Pill variant={e.resolved ? 'success' : 'danger'} dot>
                        {e.type.replace(/_/g, ' ')}
                      </Pill>
                      {e.impactWithTax && (
                        <span className="font-numeric text-danger text-[12px]">
                          +{inr(e.impactWithTax)}
                        </span>
                      )}
                    </div>
                    <p className="text-muted mt-1 text-[12px]">{e.message}</p>
                    {e.resolved && (
                      <p className="text-accent-2 mt-0.5 text-[11px]">
                        Resolved · {e.resolutionAction?.replace(/_/g, ' ')}
                      </p>
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
            <h2 className="text-ink mb-2 text-[14px] font-semibold">Approval routing</h2>
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
                  <span className="bg-canvas font-numeric flex h-5 w-5 items-center justify-center rounded-full text-[10px]">
                    {s.stepNo}
                  </span>
                  <span className="text-text font-medium">
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
                    <span className="text-warn text-[10px] font-semibold">ESC</span>
                  )}
                  {s.delegatedFromName && (
                    <span className="text-violet text-[10px]">
                      via {s.delegatedFromName}
                    </span>
                  )}
                </span>
              ))}
              {data.liveApprovalChain.length === 0 && (
                <span className="text-muted text-[12px]">
                  No approval steps for this amount.
                </span>
              )}
            </div>
          </section>

          {/* Activity + payments + comments */}
          <section>
            <div className="border-line mb-2 flex items-center gap-1 border-b">
              {(['activity', 'payments'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActivityTab(t)}
                  className={
                    'border-b-2 px-3 py-1.5 text-[13px] font-medium capitalize ' +
                    (activityTab === t
                      ? 'border-accent text-ink'
                      : 'text-muted hover:text-text border-transparent')
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            {activityTab === 'activity' ? (
              <ul className="border-line mb-3 flex flex-col gap-1.5 border-l pl-4">
                {data.activity.map((a) => (
                  <li key={a.id} className="text-muted text-[12px]">
                    <span className="text-text font-medium">
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
                  <div className="border-line bg-panel rounded-lg border p-3 text-[12px]">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/payment-runs/${data.payment.paymentRunId}`}
                        className="font-numeric text-accent-2 font-medium"
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
                  <div className="text-muted text-[12px]">
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
                className="border-line bg-panel focus-visible:ring-accent flex-1 rounded-sm border px-3 py-2 text-[13px] outline-none focus-visible:ring-2"
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
          <div className="border-line bg-panel rounded-lg border p-4">
            <div className="text-faint text-[11px] uppercase tracking-wide">
              Amount payable
            </div>
            <div className="font-numeric tracking-display text-ink mt-1 text-[22px] font-semibold">
              {inr(data.amounts.grossAmount)}
            </div>
            <dl className="mt-3 flex flex-col gap-1 text-[12px]">
              <Row
                label={`Taxable (${data.amounts.taxKind})`}
                value={inr(data.amounts.subtotal)}
              />
              <Row label="Tax" value={inr(data.amounts.taxAmount)} />
              <Row label="TDS 194Q" value={`- ${inr(data.amounts.tdsAmount)}`} />
              <div className="border-line my-1 border-t" />
              <Row label="Net payable" value={inr(data.amounts.netPayable)} strong />
            </dl>
          </div>

          {data.payment && (
            <div className="border-accent/30 bg-accent-wash rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-accent-2 text-[12px] font-semibold">Payment</span>
                {data.payment.isStub && <Pill variant="warn">Stub UTR</Pill>}
              </div>
              <div className="font-numeric text-ink mt-1 text-[13px]">
                {data.payment.utr}
              </div>
              <Link
                href={`/payment-runs/${data.payment.paymentRunId}`}
                className="text-accent-2 mt-1 inline-block text-[11px]"
              >
                {data.payment.paymentRunNumber} →
              </Link>
            </div>
          )}

          {data.msme && data.msme.bucket !== 'SAFE' && (
            <div className="border-danger/30 bg-danger-wash rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-danger text-[12px] font-semibold">
                  MSME §15 clock
                </span>
                <Pill variant={msmeVariant(data.msme.bucket)} dot>
                  {data.msme.daysRemaining} days left
                </Pill>
              </div>
              <p className="text-danger/80 mt-1 text-[11px]">
                Due {new Date(data.msme.dueDate).toLocaleDateString('en-IN')}. Pay within
                the 45-day cap to avoid interest.
              </p>
            </div>
          )}

          <div className="border-line bg-panel rounded-lg border p-4">
            <div className="text-faint mb-2 text-[11px] uppercase tracking-wide">
              Compliance
            </div>
            <dl className="flex flex-col gap-1 text-[12px]">
              <Row label="GSTIN" value={data.compliance.gstinStatus} />
              <Row label="GSTR-2B" value={data.compliance.gstr2bStatus} />
              <Row label="IRN" value={data.compliance.irn ? 'Present' : '—'} />
              <Row label="e-Way bill" value={data.compliance.ewaybillNo ?? '—'} />
            </dl>
          </div>

          <div className="border-line bg-panel rounded-lg border p-4">
            <div className="text-faint mb-2 text-[11px] uppercase tracking-wide">
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

          <div className="border-line bg-panel rounded-lg border p-4">
            <div className="text-faint mb-2 text-[11px] uppercase tracking-wide">
              Vendor snapshot
            </div>
            <div className="text-ink text-[13px] font-medium">{data.vendor.name}</div>
            <dl className="mt-1 flex flex-col gap-1 text-[12px]">
              <Row label="Risk score" value={`A · ${data.vendor.riskScore ?? '—'}`} />
              <Row label="FYTD spend" value={inrCompact(data.vendor.fytdSpend)} />
              <Row label="On-time" value={`${data.vendor.onTimePct ?? '—'}%`} />
            </dl>
          </div>
        </aside>
      </div>

      {/* Sticky action bar */}
      <div className="border-line bg-panel/95 fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3">
          {data.status === 'AWAITING_APPROVAL' ? (
            data.canDecide ? (
              <>
                <input
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder="Add a decision comment…"
                  className="border-line bg-panel flex-1 rounded-sm border px-3 py-2 text-[13px] outline-none"
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
                className="text-muted ml-auto text-[13px]"
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
              disabled={route.isPending || openExceptions.length > 0}
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
        'bg-panel rounded-lg border p-3 ' +
        (accent === 'danger' ? 'border-danger/40' : 'border-line')
      }
    >
      <div className="text-ink text-[12px] font-semibold">{title}</div>
      <div className="font-numeric text-faint mb-2 text-[11px]">{subtitle}</div>
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
  value: string;
  strong?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={'font-numeric ' + (strong ? 'text-ink font-semibold' : 'text-text')}>
        {value}
      </dd>
    </div>
  );
}
