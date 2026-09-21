'use client';

import {
  Button,
  DataState,
  Field,
  Input,
  PageHeader,
  Pill,
  SandboxBanner,
  Select,
  Skeleton,
} from '@/components/ui';
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

/** Provider enums in words; the raw constants read as a system dump. */
const PROVIDER_LABEL: Record<string, string> = {
  OCR: 'OCR (document reading)',
  GSP: 'GSP (GST portal)',
  EMAIL_INBOUND: 'Inbound email',
};
const thisMonth = new Date().toISOString().slice(0, 7);

export default function IntegrationsPage(): React.JSX.Element {
  const push = useToastStore((s) => s.push);
  const credsQuery = useCredentialStatus();
  const usageQuery = useIntegrationUsage(thisMonth);
  const creds = credsQuery.data;
  const usage = usageQuery.data;
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
    <div>
      <PageHeader
        title="Integrations"
        description="Provider credentials, encrypted at rest, and this workspace's usage of each provider."
      />

      {anySimulated && (
        <SandboxBanner className="mb-4">
          <span className="font-semibold">Some providers are simulated.</span> Results
          from them are produced by a sandbox and carry no assurance — they are marked
          throughout the app. A credential can be configured and still be a sandbox key,
          so the badges below reflect what the recorded calls actually returned.
        </SandboxBanner>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Credential vault */}
        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-3 text-h3 font-semibold text-ink">Credentials</h2>
          <DataState
            isLoading={credsQuery.isLoading}
            error={credsQuery.error}
            onRetry={() => void credsQuery.refetch()}
            compact
          >
          <div className="mb-3 space-y-2">
            {PROVIDERS.map((p) => {
              const c = configured.get(p);
              const simulated = isSimulated(p);
              return (
                <div key={p}
                  className="flex flex-wrap items-center justify-between gap-1.5 text-body-sm"
                >
                  <span className="text-text">{PROVIDER_LABEL[p] ?? p}</span>
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
                      <Pill variant="success">Live</Pill>
                    ) : !c ? (
                      <Pill variant="neutral">Simulated — no credential set</Pill>
                    ) : (
                      <Pill variant="neutral">Credential set, still simulating</Pill>
                    )}
                    {c?.label ? (
                      <span className="text-faint text-micro">{c.label}</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
          </DataState>
          <div className="space-y-3 border-t border-line pt-3">
            <p className="text-caption text-muted">
              Set a credential (stored AES-256-GCM; never returned or logged). Only
              providers whose account belongs to this tenant appear here — OCR and inbound
              email are configured once for the whole deployment.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Provider" htmlFor="cred-provider">
                <Select
                  id="cred-provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  {CREDENTIAL_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {PROVIDER_LABEL[p] ?? p}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Label" htmlFor="cred-label" hint="Optional">
                <Input
                  id="cred-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </Field>
              <Field label="Key" htmlFor="cred-key" hint="For example apiKey">
                <Input id="cred-key" value={key} onChange={(e) => setKey(e.target.value)} />
              </Field>
              <Field label="Secret value" htmlFor="cred-value">
                <Input
                  id="cred-value"
                  type="password"
                  autoComplete="off"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => void save()}
                disabled={setCred.isPending}
              >
                {setCred.isPending ? 'Saving…' : 'Save credential'}
              </Button>
            </div>
          </div>
        </div>

        {/* Usage + jobs */}
        <div className="rounded-lg border border-line bg-panel p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-h3 font-semibold text-ink">
              Usage
              <span className="ml-2 font-numeric text-body-sm font-normal text-muted">
                {thisMonth}
              </span>
            </h2>
            <Button
              variant="secondary"
              size="sm"
              disabled={runGstr2b.isPending}
              onClick={async () => {
                try {
                  const r = await runGstr2b.mutateAsync();
                  push(
                    `GSTR-2B: ${r.matched} matched, ${r.mismatchAmount + r.mismatchDate} mismatch, ${r.notFound} not-found`,
                    'success',
                  );
                } catch (e) {
                  push(e instanceof Error ? e.message : 'Failed', 'error');
                }
              }}
            >
              {runGstr2b.isPending ? 'Reconciling…' : 'Run GSTR-2B reconciliation'}
            </Button>
          </div>
          <DataState
            isLoading={usageQuery.isLoading}
            error={usageQuery.error}
            onRetry={() => void usageQuery.refetch()}
            isEmpty={!usage || usage.rows.length === 0}
            compact
            empty={{
              title: 'No integration calls this month',
              detail: 'Calls to OCR, the GST portal and inbound email are counted here as they happen.',
            }}
            loading={
              <div className="flex flex-col gap-2" aria-busy="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            }
          >
          {usage && (
            <table className="pf-stack w-full text-body-sm">
              <thead className="border-line border-b text-left text-caption text-muted">
                <tr>
                  <th className="py-2.5 pr-3 font-medium">Operation</th>
                  <th className="px-3 py-2.5 text-right font-medium">Calls</th>
                  <th className="px-3 py-2.5 text-right font-medium">Errors</th>
                  <th className="py-2.5 pl-3 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {usage.rows.map((r) => (
                  <tr
                    key={`${r.provider}-${r.operation}`}
                    className="border-b border-line last:border-0"
                  >
                    <td className="py-3 pr-3">
                      <span className="font-numeric flex flex-wrap items-center gap-1.5">
                        {r.operation}
                        {/* This is the console where "simulated" is the
                            subject, so it is stated as a count rather than
                            deferred to a tooltip. */}
                        {r.simulatedCalls > 0 ? (
                          <span className="text-muted text-micro">
                            {r.simulatedCalls === r.calls
                              ? 'all simulated'
                              : `${r.simulatedCalls} of ${r.calls} simulated`}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="font-numeric px-3 py-3 text-right">{r.calls}</td>
                    <td
                      className={
                        'font-numeric px-3 py-3 text-right ' +
                        (r.errors > 0 ? 'text-danger' : 'text-text')
                      }
                    >
                      {r.errors}
                    </td>
                    <td className="font-numeric py-3 pl-3 text-right">{inr(r.costInr)}</td>
                  </tr>
                ))}
              </tbody>
              {/* A footer rather than a body row, so the stacked phone layout
                  does not turn the total into a card of empty labels. */}
              <tfoot className="border-line border-t">
                <tr className="font-semibold text-ink">
                  <td className="py-3 pr-3">Total</td>
                  <td colSpan={3} className="font-numeric py-3 pl-3 text-right">
                    {inr(usage.totalInr)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
          </DataState>
        </div>
      </div>

      <p className="mt-4 text-caption text-muted">
        Invoice intake queues (email → invoice, manual OCR review) live under{' '}
        <Link href="/invoices/intake" className="text-accent hover:underline">
          Invoices → Intake
        </Link>
        .
      </p>
    </div>
  );
}
