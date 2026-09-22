'use client';

import { Button, Pill, SandboxChip } from '@/components/ui';

import {
  useConfirmBank,
  useReconciliation,
  useRetryFailedItems,
} from '@/lib/api/payments';
import { formatDateTime, inr, statusLabel } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

const SHOW_FOR = [
  'SUBMITTED_PENDING_BANK_CONFIRMATION',
  'SUBMITTED_TO_BANK',
  'COMPLETED',
  'FAILED',
];

const bankVariant = (s: string): 'success' | 'danger' | 'info' | 'neutral' =>
  s === 'CONFIRMED'
    ? 'success'
    : s === 'FAILED'
      ? 'danger'
      : s === 'SUBMITTED'
        ? 'info'
        : 'neutral';

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
    <section className="border-line bg-panel rounded-lg border p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-ink text-h3 font-semibold">Bank reconciliation</h2>
          {/* A grey "sandbox simulator" pill read as ordinary metadata next to
              real UTRs. This is money movement — it gets the standard marker. */}
          <SandboxChip simulated={data.simulated} label="bank reconciliation" />
          <span className="text-muted text-caption">attempt #{data.attemptNo}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.canConfirm && (
            <Button
              variant="secondary"
              size="sm"
              disabled={confirm.isPending}
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
            >
              Poll bank confirmation
            </Button>
          )}
          {data.canRetry && (
            <Button
              variant="secondary"
              size="sm"
              disabled={retry.isPending}
              onClick={async () => {
                try {
                  const r = await retry.mutateAsync();
                  push(`${r.retried} failed item(s) reset for resubmission`, 'info');
                } catch (e) {
                  push(e instanceof Error ? e.message : 'Retry failed', 'error');
                }
              }}
            >
              Retry failed items
            </Button>
          )}
        </div>
      </div>

      <div className="text-muted mb-3 flex flex-wrap gap-x-4 gap-y-1 text-caption">
        <span>{data.acceptedCount} accepted</span>
        <span>{data.failedCount} failed</span>
        {data.submittedAt && (
          <span>Submitted {formatDateTime(data.submittedAt)}</span>
        )}
        {data.confirmedAt && (
          <span>Confirmed {formatDateTime(data.confirmedAt)}</span>
        )}
      </div>

      <table className="pf-stack w-full text-body-sm">
        <thead className="border-line border-b text-left text-caption text-muted">
          <tr>
            <th className="px-3 py-2.5 font-medium">Invoice</th>
            <th className="px-3 py-2.5 font-medium">Vendor</th>
            <th className="px-3 py-2.5 text-right font-medium">Net</th>
            <th className="px-3 py-2.5 font-medium">Bank status</th>
            <th className="px-3 py-2.5 font-medium">UTR</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it) => (
            <tr key={it.invoiceId} className="border-line border-b last:border-0">
              <td className="font-numeric px-3 py-3">{it.invoiceNumber}</td>
              <td className="text-text px-3 py-3">{it.vendorName}</td>
              <td className="font-numeric px-3 py-3 text-right">{inr(it.net)}</td>
              <td className="px-3 py-3">
                <Pill variant={bankVariant(it.bankStatus)} dot>
                  {statusLabel(it.bankStatus)}
                </Pill>
                {it.bankErrorMessage && (
                  <span className="text-danger ml-1 text-micro">
                    {it.bankErrorMessage}
                  </span>
                )}
              </td>
              <td className="font-numeric text-muted px-3 py-3 text-caption">
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
              className="flex flex-wrap items-center gap-2 py-0.5 text-caption"
            >
              <span className="font-numeric">{r.utr}</span>
              {r.isStub ? (
                <Pill variant="warn">Stub UTR</Pill>
              ) : (
                <Pill variant="success">Bank UTR</Pill>
              )}
              <span className="font-numeric text-muted">{inr(r.net)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
