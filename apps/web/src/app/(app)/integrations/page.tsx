'use client';

import { Pill } from '@procureflow/ui';
import Link from 'next/link';
import { useState } from 'react';

import {
  useCredentialStatus,
  useIntegrationUsage,
  useRunGstr2b,
  useSetCredential,
} from '@/lib/api/integrations';
import { inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

const PROVIDERS = ['OCR', 'GSP', 'EMAIL_INBOUND'];
const thisMonth = new Date().toISOString().slice(0, 7);

export default function IntegrationsPage(): React.JSX.Element {
  const push = useToastStore((s) => s.push);
  const { data: creds } = useCredentialStatus();
  const { data: usage } = useIntegrationUsage(thisMonth);
  const setCred = useSetCredential();
  const runGstr2b = useRunGstr2b();

  const [provider, setProvider] = useState('GSP');
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('apiKey');
  const [value, setValue] = useState('');

  const configured = new Map((creds ?? []).map((c) => [c.provider, c]));

  const save = async (): Promise<void> => {
    if (!value) {
      push('Enter a secret value', 'error');
      return;
    }
    try {
      await setCred.mutateAsync({
        provider: provider as 'GSP',
        label: label || null,
        payload: { [key]: value },
      });
      push('Credential encrypted & stored', 'success');
      setValue('');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Failed', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="tracking-heading text-ink text-[20px] font-semibold">
          Integrations
        </h1>
        <p className="text-muted text-[13px]">
          Provider credentials (encrypted at rest) & per-tenant usage · Star Cement Ltd
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Credential vault */}
        <div className="border-line bg-panel rounded-lg border p-4">
          <h2 className="text-ink mb-2 text-[13px] font-semibold">Credentials</h2>
          <div className="mb-3 space-y-1">
            {PROVIDERS.map((p) => {
              const c = configured.get(p as never);
              return (
                <div key={p} className="flex items-center justify-between text-[13px]">
                  <span className="font-numeric">{p}</span>
                  {c ? (
                    <Pill variant="success" dot>
                      configured{c.label ? ` · ${c.label}` : ''}
                    </Pill>
                  ) : (
                    <Pill variant="gray">using sandbox simulator</Pill>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-line space-y-2 border-t pt-3">
            <p className="text-muted text-[12px]">
              Set a credential (stored AES-256-GCM; never returned or logged).
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="border-line rounded-md border px-2 py-1.5 text-[13px]"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                {PROVIDERS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <input
                className="border-line rounded-md border px-2 py-1.5 text-[13px]"
                placeholder="Label (optional)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <input
                className="border-line rounded-md border px-2 py-1.5 text-[13px]"
                placeholder="Key (e.g. apiKey)"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <input
                className="border-line rounded-md border px-2 py-1.5 text-[13px]"
                placeholder="Secret value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={save}
              className="bg-ink rounded-md px-3 py-1.5 text-[13px] font-medium text-white"
            >
              Save credential
            </button>
          </div>
        </div>

        {/* Usage + jobs */}
        <div className="border-line bg-panel rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-ink text-[13px] font-semibold">Usage — {thisMonth}</h2>
            <button
              type="button"
              onClick={async () => {
                try {
                  const r = await runGstr2b.mutateAsync();
                  push(
                    `GSTR-2B: ${r.matched} matched · ${r.mismatchAmount + r.mismatchDate} mismatch · ${r.notFound} not-found`,
                    'success',
                  );
                } catch (e) {
                  push(e instanceof Error ? e.message : 'Failed', 'error');
                }
              }}
              className="border-line text-text hover:bg-canvas rounded-md border px-3 py-1.5 text-[12px]"
            >
              Run GSTR-2B reconciliation
            </button>
          </div>
          {!usage || usage.rows.length === 0 ? (
            <p className="text-muted py-6 text-center text-[13px]">
              No integration calls yet.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="text-muted border-line border-b text-left text-[12px]">
                <tr>
                  <th className="py-1.5 font-medium">Operation</th>
                  <th className="py-1.5 text-right font-medium">Calls</th>
                  <th className="py-1.5 text-right font-medium">Errors</th>
                  <th className="py-1.5 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {usage.rows.map((r) => (
                  <tr
                    key={`${r.provider}-${r.operation}`}
                    className="border-line border-b last:border-0"
                  >
                    <td className="py-1.5">
                      {r.operation}
                      {r.simulatedCalls > 0 && (
                        <span className="text-faint ml-1 text-[11px]">(sim)</span>
                      )}
                    </td>
                    <td className="font-numeric py-1.5 text-right">{r.calls}</td>
                    <td className="font-numeric py-1.5 text-right">{r.errors}</td>
                    <td className="font-numeric py-1.5 text-right">{inr(r.costInr)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1.5">Total</td>
                  <td />
                  <td />
                  <td className="font-numeric py-1.5 text-right">
                    {inr(usage.totalInr)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="text-muted mt-4 text-[12px]">
        Invoice intake queues (email → invoice, manual OCR review) live under{' '}
        <Link href="/invoices/intake" className="text-accent-2">
          Invoices → Intake
        </Link>
        .
      </p>
    </div>
  );
}
