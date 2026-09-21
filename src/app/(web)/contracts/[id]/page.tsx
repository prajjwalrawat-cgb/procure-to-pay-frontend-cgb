'use client';

import { Button, PageHeader, Pill } from '@/components/ui';
import { ArrowLeft, FileText } from 'lucide-react';
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
import { inr, statusLabel, statusVariant } from '@/lib/format';
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
  const { data: c, isLoading } = useContract(id);
  const [rateYear, setRateYear] = useState(1);

  const submit = useSubmitContract(id);
  const decide = useDecideContract(id);
  const execute = useExecuteContract(id);
  const renew = useRenewContract(id);
  const terminate = useTerminateContract(id);

  if (isLoading || !c) {
    return (
      <p className="py-10 text-center text-body-sm text-muted">
        Loading…
      </p>
    );
  }

  const vt = c.volumeTracking;

  const act = async (fn: () => Promise<unknown>, ok: string): Promise<void> => {
    try {
      await fn();
      push(ok, 'success');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Action failed', 'error');
    }
  };

  return (
    <div className="pb-24">
      <Link
        href="/contracts"
        className="mb-3 inline-flex items-center gap-1 text-body-sm text-muted hover:text-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Contracts
      </Link>

      <PageHeader
        title={c.title}
        meta={
          <Pill variant={statusVariant(c.status)} dot>
            {statusLabel(c.status)}
          </Pill>
        }
        description={
          <span className="font-numeric">
            {c.number}, {c.vendor.name}, {c.category}
          </span>
        }
        actions={
          <>
            {c.pdfAvailable && (
              <button
                type="button"
                onClick={() =>
                  openAuthedAsset(`/contracts/${id}/pdf`).catch((e) =>
                    push(e instanceof Error ? e.message : 'Could not open PDF', 'error'),
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-body-sm text-text hover:bg-canvas"
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </button>
            )}
          </>
        }
      />

      {/* Stage strip */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-panel p-3">
        {c.stages.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <span
              className={
                'rounded-full px-2.5 py-1 text-caption font-medium ' +
                (s.state === 'done'
                  ? 'bg-accent-wash text-accent-2'
                  : s.state === 'active'
                    ? 'bg-ink text-white'
                    : 'bg-canvas text-faint')
              }
            >
              {s.label}
            </span>
            {i < c.stages.length - 1 && <span className="text-faint">→</span>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {/* Rate card */}
          <Section title="Rate card">
            {c.rateYears.length > 1 && (
              <div className="mb-2 flex gap-1">
                {c.rateYears.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setRateYear(y)}
                    className={
                      'rounded px-2 py-1 text-caption ' +
                      (rateYear === y ? 'bg-ink text-white' : 'bg-canvas text-muted')
                    }
                  >
                    Year {y}
                  </button>
                ))}
              </div>
            )}
            <table className="w-full text-body-sm">
              <thead className="border-line border-b text-left text-caption text-muted">
                <tr>
                  <th className="py-1.5 font-medium">Item / Route</th>
                  <th className="py-1.5 font-medium">UOM</th>
                  <th className="py-1.5 font-medium">Band</th>
                  <th className="py-1.5 text-right font-medium">Unit rate</th>
                </tr>
              </thead>
              <tbody>
                {c.rateCards
                  .filter((r) => r.rateYear === rateYear)
                  .map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className="py-1.5">
                        {r.routeOrigin
                          ? `${r.routeOrigin} → ${r.routeDest ?? ''}`
                          : r.itemDesc}
                      </td>
                      <td className="py-1.5 text-muted">{r.uom}</td>
                      <td className="py-1.5 text-muted">
                        {r.volumeBandMin || r.volumeBandMax
                          ? `${r.volumeBandMin ?? '0'}–${r.volumeBandMax ?? '∞'}`
                          : '—'}
                      </td>
                      <td className="font-numeric py-1.5 text-right">
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
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-muted">
                  {vt.period}, {vt.actualQty} / {vt.committedQty} {vt.commitmentUom}
                </span>
                <Pill variant={statusVariant(vt.status)} dot>
                  {statusLabel(vt.status)}
                </Pill>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-canvas">
                <div className="h-full bg-accent"
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
            <div className="space-y-3">
              {c.clauses.map((cl) => (
                <div key={cl.id}>
                  <p className="text-body-sm font-medium text-ink">
                    {cl.title}{' '}
                    <span className="text-micro text-faint">
                      ({CLAUSE_LABEL[cl.clauseType] ?? cl.clauseType})
                    </span>
                  </p>
                  <p className="text-caption text-muted">{cl.contentText}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Call-offs */}
          <Section title={`Call-off history (${c.callOffs.length})`}>
            {c.callOffs.length === 0 ? (
              <p className="text-body-sm text-muted">No call-offs yet.</p>
            ) : (
              <table className="w-full text-body-sm">
                <thead className="border-line border-b text-left text-caption text-muted">
                  <tr>
                    <th className="py-1.5 font-medium">PO</th>
                    <th className="py-1.5 font-medium">Status</th>
                    <th className="py-1.5 text-right font-medium">Qty</th>
                    <th className="py-1.5 text-right font-medium">Value</th>
                    <th className="py-1.5 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {c.callOffs.map((co) => (
                    <tr key={co.id} className="border-b border-line last:border-0">
                      <td className="py-1.5">
                        <Link
                          href={`/purchase-orders/${co.poId}`}
                          className="font-numeric text-accent-2"
                        >
                          {co.poNumber}
                        </Link>
                      </td>
                      <td className="py-1.5">
                        <Pill variant={statusVariant(co.poStatus)}>
                          {statusLabel(co.poStatus)}
                        </Pill>
                      </td>
                      <td className="font-numeric py-1.5 text-right">{co.qty}</td>
                      <td className="font-numeric py-1.5 text-right">{inr(co.value)}</td>
                      <td className="py-1.5 text-muted">{co.calledOffAt.slice(0, 10)}</td>
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
                <div key={a.id}
                  className="flex items-center justify-between border-b border-line py-1.5 text-body-sm last:border-0"
                >
                  <span>
                    #{a.amendmentNo}, {a.changeSummary}
                  </span>
                  <Pill variant={statusVariant(a.status)}>{statusLabel(a.status)}</Pill>
                </div>
              ))}
            </Section>
          )}
        </div>

        {/* Right panel */}
        <aside className="space-y-4">
          <Section title="Summary">
            <Row label="Value" value={inr(c.totalValueEstimate)} mono />
            <Row
              label="Validity"
              value={`${c.validityStart.slice(0, 10)} → ${c.validityEnd.slice(0, 10)}`}
            />
            <Row
              label="Expires in"
              value={c.daysToExpiry >= 0 ? `${c.daysToExpiry} days` : 'Expired'}
            />
            <Row label="Payment" value={c.paymentTerms?.kind ?? '—'} />
            {c.escalationClause && (
              <Row
                label="Escalation"
                value={`${c.escalationClause.type} (${c.escalationClause.reviewFrequency})`}
              />
            )}
            {c.rfqId && <Row label="Sourced from" value="Framework RFQ" />}
            {c.supersededByContractId && (
              <Link
                href={`/contracts/${c.supersededByContractId}`}
                className="text-caption text-accent-2"
              >
                → Superseded by newer contract
              </Link>
            )}
            {c.supersedesContractId && (
              <Link
                href={`/contracts/${c.supersedesContractId}`}
                className="text-caption text-accent-2"
              >
                ← Supersedes prior contract
              </Link>
            )}
          </Section>

          {c.liveApprovalChain.length > 0 && (
            <Section title="Approval chain">
              {c.liveApprovalChain.map((s) => (
                <div key={s.approvalId ?? s.stepNo}
                  className="flex items-center justify-between py-1 text-caption"
                >
                  <span className="text-text">{s.name ?? s.role}</span>
                  <Pill
                    variant={
                      s.decision === 'APPROVED'
                        ? 'success'
                        : s.decision === 'REJECTED'
                          ? 'danger'
                          : 'gray'
                    }
                  >
                    {s.decision ?? 'PENDING'}
                  </Pill>
                </div>
              ))}
            </Section>
          )}
        </aside>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-2 px-4 py-3">
          {c.canSubmit && (
            <Button
              onClick={() => act(() => submit.mutateAsync(), 'Submitted for approval')}
            >
              Submit for approval
            </Button>
          )}
          {c.canDecide && c.myApprovalId && (
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
            <Button
              variant="danger"
              onClick={() => {
                const reason = window.prompt('Termination reason?');
                if (!reason) return;
                void act(
                  () =>
                    terminate.mutateAsync({
                      reason,
                      effectiveDate: new Date().toISOString(),
                    }),
                  'Contract terminated',
                );
              }}
            >
              Terminate
            </Button>
          )}
          {c.canCallOff && (
            <Link
              href={`/contracts/${id}/call-off/new`}
              className="rounded-md bg-ink px-4 py-1.5 text-body-sm font-medium text-white"
            >
              New call-off
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h2 className="mb-2 text-body-sm font-semibold text-ink">{title}</h2>
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
    <div className="flex items-center justify-between py-1 text-body-sm">
      <span className="text-muted">{label}</span>
      <span className={mono ? 'font-numeric text-ink' : 'text-ink'}>{value}</span>
    </div>
  );
}

