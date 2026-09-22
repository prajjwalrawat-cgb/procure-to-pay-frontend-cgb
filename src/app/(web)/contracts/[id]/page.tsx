'use client';

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ErrorState,
  Field,
  PageHeader,
  Pill,
  Skeleton,
  StageStrip,
  SubNav,
  Textarea,
} from '@/components/ui';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { openAuthedAsset } from '@/lib/api-client';
import {
  useContract,
  useDecideContract,
  useExecuteContract,
  useRenewContract,
  useSubmitContract,
  useTerminateContract,
} from '@/lib/api/contracts';
import { formatDate, humanise, inr, qty, statusLabel, statusVariant } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

const CLAUSE_LABEL: Record<string, string> = {
  PAYMENT_TERMS: 'Payment terms',
  DELIVERY_SLA: 'Delivery SLA',
  QUALITY_STANDARD: 'Quality standard',
  PENALTY: 'Penalty',
  FORCE_MAJEURE: 'Force majeure',
  CONFIDENTIALITY: 'Confidentiality',
  IP: 'IP',
  TERMINATION: 'Termination',
  LIABILITY: 'Liability',
  INSURANCE: 'Insurance',
  CUSTOM: 'Custom',
};

export default function ContractDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const push = useToastStore((s) => s.push);
  const { data: c, isLoading, error, refetch } = useContract(id);
  const [rateYear, setRateYear] = useState(1);
  const [terminating, setTerminating] = useState(false);
  const [terminateReason, setTerminateReason] = useState('');

  const submit = useSubmitContract(id);
  const decide = useDecideContract(id);
  const execute = useExecuteContract(id);
  const renew = useRenewContract(id);
  const terminate = useTerminateContract(id);

  if (error) {
    return (
      <div className="rounded-lg border border-line bg-panel">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }
  if (isLoading || !c) {
    return (
      <div aria-busy="true" aria-live="polite" className="flex flex-col gap-4">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const vt = c.volumeTracking;
  // The strip marks everything before the active stage as done. A contract
  // with no active stage has run its course, so point at the last one.
  const activeStage = c.stages.findIndex((s) => s.state === 'active');
  const stageIndex =
    activeStage >= 0
      ? activeStage
      : c.stages.every((s) => s.state === 'done')
        ? c.stages.length - 1
        : 0;
  const rates = c.rateCards.filter((r) => r.rateYear === rateYear);
  // An executed, running contract with nothing to decide has no actions; the
  // bar is left out rather than shown empty.
  const canDecideHere = c.canDecide && !!c.myApprovalId;
  const hasActions =
    c.canSubmit ||
    canDecideHere ||
    c.canExecute ||
    c.canRenew ||
    c.canTerminate ||
    c.canCallOff;

  const act = async (fn: () => Promise<unknown>, ok: string): Promise<void> => {
    try {
      await fn();
      push(ok, 'success');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Action failed', 'error');
    }
  };

  return (
    <div className={hasActions ? 'pb-24' : undefined}>
      <PageHeader
        breadcrumbs={[{ label: 'Contracts', href: '/contracts' }, { label: c.number }]}
        title={c.title}
        meta={
          <Pill variant={statusVariant(c.status)} dot>
            {statusLabel(c.status)}
          </Pill>
        }
        description={
          <>
            <span className="font-numeric">{c.number}</span> · {c.vendor.name} ·{' '}
            {c.category}
          </>
        }
        actions={
          c.pdfAvailable ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                openAuthedAsset(`/contracts/${id}/pdf`).catch((e) =>
                  push(e instanceof Error ? e.message : 'Could not open PDF', 'error'),
                )
              }
            >
              <FileText className="h-3.5 w-3.5" aria-hidden /> PDF
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 overflow-x-auto rounded-lg border border-line bg-panel p-3.5">
        <StageStrip
          stages={c.stages.map((s) => ({ key: s.key, label: s.label }))}
          activeIndex={stageIndex}
          failed={c.status === 'TERMINATED'}
          failedLabel={statusLabel(c.status)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title="Rate card" flush>
            {c.rateYears.length > 1 && (
              <SubNav
                className="mb-1 px-4"
                aria-label="Rate year"
                items={c.rateYears.map((y) => ({ key: String(y), label: `Year ${y}` }))}
                value={String(rateYear)}
                onChange={(k) => setRateYear(Number(k))}
              />
            )}
            <table className="pf-stack w-full text-body-sm">
              <thead className="border-b border-line text-left text-caption text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Item / Route</th>
                  <th className="px-3 py-2.5 font-medium">UOM</th>
                  <th className="px-3 py-2.5 font-medium">Band</th>
                  <th className="px-4 py-2.5 text-right font-medium">Unit rate</th>
                </tr>
              </thead>
              <tbody>
                {rates.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-body-sm text-muted"
                    >
                      No rates for year {rateYear}.
                    </td>
                  </tr>
                )}
                {rates.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-4 py-3.5 text-text">
                      {r.routeOrigin
                        ? `${r.routeOrigin} → ${r.routeDest ?? ''}`
                        : r.itemDesc}
                    </td>
                    <td className="px-3 py-3.5 text-muted">{r.uom}</td>
                    <td className="font-numeric px-3 py-3.5 text-muted">
                      {r.volumeBandMin || r.volumeBandMax
                        ? `${r.volumeBandMin ?? '0'}–${r.volumeBandMax ?? '∞'}`
                        : '—'}
                    </td>
                    <td className="font-numeric px-4 py-3.5 text-right">
                      {inr(r.unitRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Volume tracking */}
          {vt && vt.committedQty && (
            <Section title="Volume commitment (take-or-pay)">
              <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm">
                <span className="text-muted">
                  {vt.period}:{' '}
                  <span className="font-numeric text-text">
                    {qty(vt.actualQty)} / {qty(vt.committedQty)}
                  </span>{' '}
                  {vt.commitmentUom}
                </span>
                <Pill variant={statusVariant(vt.status)} dot>
                  {statusLabel(vt.status)}
                </Pill>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-canvas">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${Math.min(100, (vt.pctOfCommitment ?? 0) * 100)}%` }}
                />
              </div>
              {vt.projectedPctOfCommitment != null && (
                <p className="mt-1 text-caption text-muted">
                  Projected year-end: {Math.round(vt.projectedPctOfCommitment * 100)}% of
                  commitment
                </p>
              )}
            </Section>
          )}

          {/* Clauses */}
          <Section title="Clauses">
            {c.clauses.length === 0 ? (
              <p className="text-body-sm text-muted">No clauses on this contract.</p>
            ) : (
              <div className="space-y-3">
                {c.clauses.map((cl) => (
                  <div key={cl.id}>
                    <p className="flex flex-wrap items-center gap-1.5 text-body-sm font-medium text-ink">
                      {cl.title}
                      <Badge variant="neutral">
                        {CLAUSE_LABEL[cl.clauseType] ?? humanise(cl.clauseType)}
                      </Badge>
                    </p>
                    <p className="mt-0.5 text-caption text-muted">{cl.contentText}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Call-offs */}
          <Section
            title={`Call-off history (${c.callOffs.length})`}
            flush={c.callOffs.length > 0}
          >
            {c.callOffs.length === 0 ? (
              <p className="text-body-sm text-muted">
                No call-offs yet.{c.canCallOff ? ' Raise one from the bar below.' : ''}
              </p>
            ) : (
              <table className="pf-stack w-full text-body-sm">
                <thead className="border-b border-line text-left text-caption text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">PO</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                    <th className="px-3 py-2.5 text-right font-medium">Value</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {c.callOffs.map((co) => (
                    <tr key={co.id} className="border-t border-line">
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/purchase-orders/${co.poId}`}
                          className="font-numeric text-accent hover:underline"
                        >
                          {co.poNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-3.5">
                        <Pill variant={statusVariant(co.poStatus)}>
                          {statusLabel(co.poStatus)}
                        </Pill>
                      </td>
                      <td className="font-numeric px-3 py-3.5 text-right">
                        {qty(co.qty)}
                      </td>
                      <td className="font-numeric px-3 py-3.5 text-right">
                        {inr(co.value)}
                      </td>
                      <td className="font-numeric px-4 py-3.5 text-muted">
                        {formatDate(co.calledOffAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Amendments */}
          {c.amendments.length > 0 && (
            <Section title="Amendment history">
              {c.amendments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 border-b border-line py-2 text-body-sm last:border-0"
                >
                  <span className="min-w-0">
                    <span className="font-numeric text-muted">#{a.amendmentNo}</span>{' '}
                    {a.changeSummary}
                  </span>
                  <Pill variant={statusVariant(a.status)}>{statusLabel(a.status)}</Pill>
                </div>
              ))}
            </Section>
          )}
        </div>

        {/* Right panel */}
        <aside className="flex min-w-0 flex-col gap-4">
          <Section title="Summary">
            <Row label="Value" value={inr(c.totalValueEstimate)} mono />
            <Row
              label="Validity"
              value={`${formatDate(c.validityStart)} → ${formatDate(c.validityEnd)}`}
              mono
            />
            <Row
              label="Expires in"
              value={c.daysToExpiry >= 0 ? `${c.daysToExpiry} days` : 'Expired'}
            />
            <Row
              label="Payment"
              value={c.paymentTerms ? humanise(c.paymentTerms.kind) : '—'}
            />
            {c.escalationClause && (
              <Row
                label="Escalation"
                value={`${humanise(c.escalationClause.type)} (${humanise(c.escalationClause.reviewFrequency).toLowerCase()})`}
              />
            )}
            {c.rfqId && <Row label="Sourced from" value="Framework RFQ" />}
            {c.supersededByContractId && (
              <Link
                href={`/contracts/${c.supersededByContractId}`}
                className="mt-1 block text-caption text-accent hover:underline"
              >
                Superseded by a newer contract →
              </Link>
            )}
            {c.supersedesContractId && (
              <Link
                href={`/contracts/${c.supersedesContractId}`}
                className="mt-1 block text-caption text-accent hover:underline"
              >
                ← Supersedes a prior contract
              </Link>
            )}
          </Section>

          {c.liveApprovalChain.length > 0 && (
            <Section title="Approval chain">
              {c.liveApprovalChain.map((s) => (
                <div
                  key={s.approvalId ?? s.stepNo}
                  className="flex items-center justify-between gap-3 py-1 text-caption"
                >
                  <span className="min-w-0 truncate text-text">
                    {s.name ?? humanise(s.role)}
                  </span>
                  <Pill
                    variant={
                      s.decision === 'APPROVED'
                        ? 'success'
                        : s.decision === 'REJECTED'
                          ? 'danger'
                          : 'neutral'
                    }
                  >
                    {statusLabel(s.decision ?? 'PENDING')}
                  </Pill>
                </div>
              ))}
            </Section>
          )}
        </aside>
      </div>

      {/* Sticky action bar */}
      {hasActions && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-panel/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-end gap-2 px-4 py-3 sm:px-6">
            {c.canSubmit && (
              <Button
                variant="primary"
                onClick={() => act(() => submit.mutateAsync(), 'Submitted for approval')}
              >
                Submit for approval
              </Button>
            )}
            {canDecideHere && (
              <>
                <Button
                  variant="secondary"
                  onClick={() =>
                    act(
                      () =>
                        decide.mutateAsync({
                          approvalId: c.myApprovalId!,
                          decision: 'REJECT',
                        }),
                      'Rejected',
                    )
                  }
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  onClick={() =>
                    act(
                      () =>
                        decide.mutateAsync({
                          approvalId: c.myApprovalId!,
                          decision: 'APPROVE',
                        }),
                      'Approved',
                    )
                  }
                >
                  Approve
                </Button>
              </>
            )}
            {c.canExecute && (
              <Button
                variant="primary"
                onClick={() => act(() => execute.mutateAsync(), 'Contract executed')}
              >
                Execute
              </Button>
            )}
            {c.canRenew && (
              <Button
                variant="secondary"
                onClick={() =>
                  act(async () => {
                    const r = await renew.mutateAsync({});
                    router.push(`/contracts/${r.id}`);
                  }, 'Renewal draft created')
                }
              >
                Renew
              </Button>
            )}
            {c.canTerminate && (
              // Opens the confirm step; the red button lives inside the dialog.
              <Button variant="ghost" onClick={() => setTerminating(true)}>
                Terminate
              </Button>
            )}
            {c.canCallOff && (
              <Button
                asChild
                variant={c.canExecute || c.canSubmit ? 'secondary' : 'primary'}
              >
                <Link href={`/contracts/${id}/call-off/new`}>New call-off</Link>
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={terminating}
        onOpenChange={(o) => {
          if (!o) {
            setTerminating(false);
            setTerminateReason('');
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Terminate {c.number}?</DialogTitle>
          <DialogDescription className="mt-1">
            The contract ends today and no further call-offs can be raised against it.
            This cannot be undone.
          </DialogDescription>
          <Field label="Reason" required className="mt-4">
            <Textarea
              rows={3}
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setTerminating(false)}
              disabled={terminate.isPending}
            >
              Back
            </Button>
            <Button
              variant="danger"
              disabled={!terminateReason.trim() || terminate.isPending}
              onClick={() =>
                void act(async () => {
                  await terminate.mutateAsync({
                    reason: terminateReason.trim(),
                    effectiveDate: new Date().toISOString(),
                  });
                  setTerminating(false);
                  setTerminateReason('');
                }, 'Contract terminated')
              }
            >
              Terminate contract
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** A titled card. `flush` lets a table run edge to edge under the title. */
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
    <div className={'rounded-lg border border-line bg-panel ' + (flush ? 'pt-4' : 'p-4')}>
      <h2 className={'mb-2 text-h3 font-semibold text-ink ' + (flush ? 'px-4' : '')}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-body-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span
        className={'min-w-0 text-right ' + (mono ? 'font-numeric text-ink' : 'text-ink')}
      >
        {value}
      </span>
    </div>
  );
}
