'use client';

import { PageHeader, Pill, SandboxBanner, SandboxChip } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';
import type { IntegrationProvider } from '@/lib/shared';

import {
  useCredentialStatus,
  useIntegrationUsage,
  useRunGstr2b,
  useSetCredential,
} from '@/lib/api/integrations';
import { inr } from '@/lib/format';
import { useProviderLiveness } from '@/lib/integration-status';
import { tenantSuffix, useTenantName } from '@/store/session-store';
import { useToastStore } from '@/store/toast-store';

/** Every provider whose usage and liveness this page reports. */
const PROVIDERS: IntegrationProvider[] = ['OCR', 'GSP', 'EMAIL_INBOUND'];

/**
 * The subset that actually takes a per-tenant credential.
 *
 * GSTR-2B is the tenant's own tax data, so each tenant brings their own GSP
 * account — nobody can fetch one company's return with another's credentials.
 *
 * OCR and inbound email are not like that. Both are configured for the whole
 * deployment through the environment (`OCR_API_URL`,
 * `EMAIL_INBOUND_WEBHOOK_SECRET`) and shared by every tenant. Offering them in
 * this form invited a key that would be encrypted, stored, and then read by
 * nothing — which is worse than not offering it, because it looks like it
 * worked.
 */
const CREDENTIAL_PROVIDERS: IntegrationProvider[] = ['GSP'];
const thisMonth = new Date().toISOString().slice(0, 7);

export default function IntegrationsPage(): React.JSX.Element {
  const tenantName = useTenantName();
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
  const { isSimulated } = useProviderLiveness();

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

  const anySimulated = PROVIDERS.some((p) => isSimulated(p));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Integrations"
        description={`Provider credentials (encrypted at rest) & per-tenant usage${tenantSuffix(tenantName)}`}
      />

      {anySimulated && (
        <SandboxBanner className="mb-4">
          <span className="font-semibold">Some providers are simulated.</span> Results
          from them are produced by a sandbox and carry no assurance — they are marked
          throughout the app. A credential can be configured and still be a sandbox key,
          so the badges below reflect what the recorded calls actually returned.
        </SandboxBanner>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Credential vault */}
        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-2 text-[13px] font-semibold text-ink">Credentials</h2>
          <div className="mb-3 space-y-1">
            {PROVIDERS.map((p) => {
              const c = configured.get(p);
              const simulated = isSimulated(p);
              return (
                <div
                  key={p}
                  className="flex flex-wrap items-center justify-between gap-1.5 text-[13px]"
                >
                  <span className="font-numeric">{p}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {/* Green is reserved for a provider whose recorded calls came
                        back real. A configured-but-sandbox credential (the demo
                        tenant's GSP is exactly that) previously rendered the same
                        green "configured" as a live one. */}
                    {/* Order matters. "using sandbox simulator" keyed off the
                        absence of a tenant credential, which says nothing about
                        a provider configured through the environment: OCR has
                        no credential row by design and was labelled a simulator
                        while returning real extractions. Recorded behaviour
                        decides first; the credential only colours the wording. */}
                    {!simulated ? (
                      <Pill variant="success" dot>
                        live{c?.label ? ` · ${c.label}` : ''}
                      </Pill>
                    ) : !c ? (
                      <Pill variant="gray">using sandbox simulator</Pill>
                    ) : (
                      <Pill variant="outline">
                        configured{c.label ? ` · ${c.label}` : ''}
                      </Pill>
                    )}
                    <SandboxChip
                      simulated={simulated}
                      label={`${p} responses`}
                      size="xs"
                    />
                  </span>
                </div>
              );
            })}
          </div>
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-[12px] text-muted">
              Set a credential (stored AES-256-GCM; never returned or logged). Only
              providers whose account belongs to this tenant appear here — OCR and inbound
              email are configured once for the whole deployment.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="rounded-md border border-line px-2 py-1.5 text-[13px]"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                {CREDENTIAL_PROVIDERS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <input
                className="rounded-md border border-line px-2 py-1.5 text-[13px]"
                placeholder="Label (optional)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <input
                className="rounded-md border border-line px-2 py-1.5 text-[13px]"
                placeholder="Key (e.g. apiKey)"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <input
                className="rounded-md border border-line px-2 py-1.5 text-[13px]"
                placeholder="Secret value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={save}
              className="rounded-md bg-ink px-3 py-1.5 text-[13px] font-medium text-white"
            >
              Save credential
            </button>
          </div>
        </div>

        {/* Usage + jobs */}
        <div className="rounded-lg border border-line bg-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-ink">Usage — {thisMonth}</h2>
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
              className="rounded-md border border-line px-3 py-1.5 text-[12px] text-text hover:bg-canvas"
            >
              Run GSTR-2B reconciliation
            </button>
          </div>
          {!usage || usage.rows.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted">
              No integration calls yet.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="border-b border-line text-left text-[12px] text-muted">
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
                    className="border-b border-line last:border-0"
                  >
                    <td className="py-1.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {r.operation}
                        {/* Was a faint grey "(sim)" that read as a footnote. */}
                        <SandboxChip
                          simulated={r.simulatedCalls > 0}
                          label={
                            r.simulatedCalls === r.calls
                              ? `${r.operation} calls — all ${r.calls} simulated`
                              : `${r.operation} calls — ${r.simulatedCalls} of ${r.calls} simulated`
                          }
                          size="xs"
                        />
                      </span>
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

      <p className="mt-4 text-[12px] text-muted">
        Invoice intake queues (email → invoice, manual OCR review) live under{' '}
        <Link href="/invoices/intake" className="text-accent-2">
          Invoices → Intake
        </Link>
        .
      </p>
    </div>
  );
}
