'use client';

import { Pill } from '@/components/ui';
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
      <p className="text-muted mx-auto max-w-6xl py-10 text-center text-[13px]">
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
    <div className="mx-auto max-w-6xl pb-24">
      <Link
        href="/contracts"
        className="text-muted hover:text-text mb-3 inline-flex items-center gap-1 text-[13px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Contracts
      </Link>

      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="tracking-heading text-ink text-[20px] font-semibold">
              {c.title}
            </h1>
            <Pill variant={statusVariant(c.status)} dot>
              {statusLabel(c.status)}
            </Pill>
          </div>
          <p className="text-muted font-numeric text-[13px]">
            {c.number} · {c.vendor.name} · {c.category}
          </p>
        </div>
        {c.pdfAvailable && (
          <button
            type="button"
            onClick={() =>
              openAuthedAsset(`/contracts/${id}/pdf`).catch((e) =>
                push(e instanceof Error ? e.message : 'Could not open PDF', 'error'),
              )
            }
            className="border-line text-text hover:bg-canvas inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px]"
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
        )}
      </div>

      {/* Stage strip */}
      <div className="border-line bg-panel mb-4 flex items-center gap-2 rounded-lg border p-3">
        {c.stages.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <span
              className={
                'rounded-full px-2.5 py-1 text-[12px] font-medium ' +
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

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
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
                      'rounded px-2 py-1 text-[12px] ' +
                      (rateYear === y ? 'bg-ink text-white' : 'bg-canvas text-muted')
                    }
                  >
                    Year {y}
                  </button>
                ))}
              </div>
            )}
            <table className="w-full text-[13px]">
              <thead className="text-muted border-line border-b text-left text-[12px]">
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
                    <tr key={r.id} className="border-line border-b last:border-0">
                      <td className="py-1.5">
                        {r.routeOrigin
                          ? `${r.routeOrigin} → ${r.routeDest ?? ''}`
                          : r.itemDesc}
                      </td>
                      <td className="text-muted py-1.5">{r.uom}</td>
                      <td className="text-muted py-1.5">
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
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted">
                  {vt.period} · {vt.actualQty} / {vt.committedQty} {vt.commitmentUom}
                </span>
                <Pill variant={statusVariant(vt.status)} dot>
                  {statusLabel(vt.status)}
                </Pill>
              </div>
              <div className="bg-canvas mt-2 h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-accent h-full"
                  style={{ width: `${Math.min(100, (vt.pctOfCommitment ?? 0) * 100)}%` }}
                />
              </div>
              {vt.projectedPctOfCommitment != null && (
                <p className="text-muted mt-1 text-[12px]">
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
                  <p className="text-ink text-[13px] font-medium">
                    {cl.title}{' '}
                    <span className="text-faint text-[11px]">
                      ({CLAUSE_LABEL[cl.clauseType] ?? cl.clauseType})
                    </span>
                  </p>
                  <p className="text-muted text-[12px]">{cl.contentText}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Call-offs */}
          <Section title={`Call-off history (${c.callOffs.length})`}>
            {c.callOffs.length === 0 ? (
              <p className="text-muted text-[13px]">No call-offs yet.</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="text-muted border-line border-b text-left text-[12px]">
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
                    <tr key={co.id} className="border-line border-b last:border-0">
                      <td className="py-1.5">
                        <Link
                          href={`/purchase-orders/${co.poId}`}
                          className="text-accent-2 font-numeric"
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
                      <td className="text-muted py-1.5">{co.calledOffAt.slice(0, 10)}</td>
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
                  className="border-line flex items-center justify-between border-b py-1.5 text-[13px] last:border-0"
                >
                  <span>
                    #{a.amendmentNo} · {a.changeSummary}
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
                className="text-accent-2 text-[12px]"
              >
                → Superseded by newer contract
              </Link>
            )}
            {c.supersedesContractId && (
              <Link
                href={`/contracts/${c.supersedesContractId}`}
                className="text-accent-2 text-[12px]"
              >
                ← Supersedes prior contract
              </Link>
            )}
          </Section>

          {c.liveApprovalChain.length > 0 && (
            <Section title="Approval chain">
              {c.liveApprovalChain.map((s) => (
                <div
                  key={s.approvalId ?? s.stepNo}
                  className="flex items-center justify-between py-1 text-[12px]"
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
      <div className="border-line bg-panel/95 fixed inset-x-0 bottom-0 z-10 border-t backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-2 px-4 py-3">
          {c.canSubmit && (
            <Btn
              onClick={() => act(() => submit.mutateAsync(), 'Submitted for approval')}
            >
              Submit for approval
            </Btn>
          )}
          {c.canDecide && c.myApprovalId && (
            <>
              <Btn
                variant="danger"
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
              </Btn>
              <Btn
                variant="accent"
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
              </Btn>
            </>
          )}
          {c.canExecute && (
            <Btn
              variant="accent"
              onClick={() => act(() => execute.mutateAsync(), 'Contract executed')}
            >
              Execute
            </Btn>
          )}
          {c.canRenew && (
            <Btn
              onClick={() =>
                act(async () => {
                  const r = await renew.mutateAsync({});
                  router.push(`/contracts/${r.id}`);
                }, 'Renewal draft created')
              }
            >
              Renew
            </Btn>
          )}
          {c.canTerminate && (
            <Btn
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
            </Btn>
          )}
          {c.canCallOff && (
            <Link
              href={`/contracts/${id}/call-off/new`}
              className="bg-ink rounded-md px-4 py-1.5 text-[13px] font-medium text-white"
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
    <div className="border-line bg-panel rounded-lg border p-4">
      <h2 className="text-ink mb-2 text-[13px] font-semibold">{title}</h2>
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
    <div className="flex items-center justify-between py-1 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className={mono ? 'font-numeric text-ink' : 'text-ink'}>{value}</span>
    </div>
  );
}

function Btn({
  children,
  onClick,
  variant = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'accent' | 'danger';
}): React.JSX.Element {
  const cls =
    variant === 'accent'
      ? 'bg-accent text-white'
      : variant === 'danger'
        ? 'bg-danger-wash text-danger'
        : 'border border-line text-text hover:bg-canvas';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-1.5 text-[13px] font-medium ${cls}`}
    >
      {children}
    </button>
  );
}
