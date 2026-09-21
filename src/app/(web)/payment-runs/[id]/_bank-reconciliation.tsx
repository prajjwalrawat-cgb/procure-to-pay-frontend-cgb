'use client';

import { Pill, SandboxChip } from '@/components/ui';

import {
  useConfirmBank,
  useReconciliation,
  useRetryFailedItems,
} from '@/lib/api/payments';
import { inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

const SHOW_FOR = [
  'SUBMITTED_PENDING_BANK_CONFIRMATION',
  'SUBMITTED_TO_BANK',
  'COMPLETED',
  'FAILED',
];

const bankVariant = (s: string): 'success' | 'danger' | 'warn' | 'gray' =>
  s === 'CONFIRMED'
    ? 'success'
    : s === 'FAILED'
      ? 'danger'
      : s === 'SUBMITTED'
        ? 'warn'
        : 'gray';

export function BankReconciliationPanel({
  runId,
  status,
}: {
  runId: string;
  status: string;
}): React.JSX.Element | null {
  const push = useToastStore((s) => s.push);
  const { data } = useReconciliation(runId);
  const confirm = useConfirmBank(runId);
  const retry = useRetryFailedItems(runId);

  if (!SHOW_FOR.includes(status) || !data) return null;

  return (
    <section className="border-line bg-panel mb-4 rounded-lg border p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-ink text-body font-semibold">Bank reconciliation</h2>
          {/* A grey "sandbox simulator" pill read as ordinary metadata next to
              real UTRs. This is money movement — it gets the standard marker. */}
          <SandboxChip simulated={data.simulated} label="bank reconciliation" />
          <span className="text-muted text-caption">attempt #{data.attemptNo}</span>
        </div>
        <div className="flex items-center gap-2">
          {data.canConfirm && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const r = await confirm.mutateAsync();
                  push(
                    `Bank confirmed — ${r.confirmed} paid, ${r.failed} failed`,
                    'success',
                  );
                } catch (e) {
                  push(e instanceof Error ? e.message : 'Confirm failed', 'error');
                }
              }}
              className="bg-ink rounded-md px-3 py-1.5 text-caption font-medium text-white"
            >
              Poll bank confirmation
            </button>
          )}
          {data.canRetry && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const r = await retry.mutateAsync();
                  push(`${r.retried} failed item(s) reset for resubmission`, 'info');
                } catch (e) {
                  push(e instanceof Error ? e.message : 'Retry failed', 'error');
                }
              }}
              className="border-line text-text hover:bg-canvas rounded-md border px-3 py-1.5 text-caption"
            >
              Retry failed items
            </button>
          )}
        </div>
      </div>

      <div className="text-muted mb-3 flex gap-4 text-caption">
        <span>{data.acceptedCount} accepted</span>
        <span>{data.failedCount} failed</span>
        {data.submittedAt && (
          <span>submitted {data.submittedAt.slice(0, 16).replace('T', ' ')}</span>
        )}
        {data.confirmedAt && (
          <span>confirmed {data.confirmedAt.slice(0, 16).replace('T', ' ')}</span>
        )}
      </div>

      <table className="w-full text-body-sm">
        <thead className="border-line border-b text-left text-caption text-muted">
          <tr>
            <th className="py-1.5 font-medium">Invoice</th>
            <th className="py-1.5 font-medium">Vendor</th>
            <th className="py-1.5 text-right font-medium">Net</th>
            <th className="py-1.5 font-medium">Bank status</th>
            <th className="py-1.5 font-medium">UTR</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it) => (
            <tr key={it.invoiceId} className="border-line border-b last:border-0">
              <td className="font-numeric py-1.5">{it.invoiceNumber}</td>
              <td className="text-text py-1.5">{it.vendorName}</td>
              <td className="font-numeric py-1.5 text-right">{inr(it.net)}</td>
              <td className="py-1.5">
                <Pill variant={bankVariant(it.bankStatus)} dot>
                  {it.bankStatus}
                </Pill>
                {it.bankErrorMessage && (
                  <span className="text-danger ml-1 text-micro">
                    {it.bankErrorMessage}
                  </span>
                )}
              </td>
              <td className="font-numeric text-muted py-1.5 text-caption">
                {it.bankUtr ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.records.length > 0 && (
        <div className="border-line mt-3 border-t pt-2">
          <p className="text-muted mb-1 text-caption">Posted payment records</p>
          {data.records.map((r) => (
            <div
              key={r.invoiceId + r.utr}
              className="flex items-center gap-2 py-0.5 text-caption"
            >
              <span className="font-numeric">{r.utr}</span>
              {r.isStub ? (
                <Pill variant="warn">stub (pre-10b)</Pill>
              ) : (
                <Pill variant="success">real UTR</Pill>
              )}
              <span className="font-numeric text-muted">{inr(r.net)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
