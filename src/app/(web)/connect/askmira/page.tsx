'use client';

import { Button, Card, PageHeader } from '@/components/ui';
import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api-client';

interface Connection {
  can_connect: boolean;
  workspace: { id: string; name: string };
  connected: boolean;
  askmira_workspace_id: string | null;
  askmira_workspace: string | null;
  askmira_origin: string | null;
  connected_at: string | null;
}

interface Ask {
  tenant_id: string;
  tenant_name: string;
  redirect_uri: string;
  state: string;
  challenge: string;
}

/** What AskMira will be able to do once allowed. */
const GRANTS = [
  'Open ProcureFlow for your people from AskMira, without a second password.',
  'Show each person their requisitions, approvals and, where their role allows, purchase orders, invoices and budgets in AskMira.',
  'Let a person approve or reject what waits on them, with their own ProcureFlow permissions.',
  'Switch off an account AskMira linked when that person leaves the company in AskMira.',
  'AskMira never adds anyone here and never changes a role: your admins still decide both.',
];

function readAsk(): Ask | null {
  const q = new URLSearchParams(window.location.search);
  const ask = {
    tenant_id: q.get('tenant_id') ?? '',
    tenant_name: q.get('tenant_name') ?? '',
    redirect_uri: q.get('redirect_uri') ?? '',
    state: q.get('state') ?? '',
    challenge: q.get('challenge') ?? '',
  };
  return Object.values(ask).every(Boolean) ? ask : null;
}

/** apiFetch throws ApiError (an Error) with the API's own words. */
function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function originOf(uri: string): string | null {
  try {
    return new URL(uri).origin;
  } catch {
    return null;
  }
}

/**
 * /connect/askmira — an AskMira workspace (the company's HRMS) asks to connect
 * to this company. A ProcureFlow admin presses Allow; AskMira then gets a key
 * that reaches this company only. Either side can disconnect.
 */
export default function ConnectAskMiraPage(): React.JSX.Element {
  const [ask, setAsk] = useState<Ask | null | undefined>(undefined);
  const [current, setCurrent] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAsk(readAsk());
    apiFetch<Connection>('/integrations/askmira/connection')
      .then(setCurrent)
      .catch((err: unknown) => setError(messageOf(err, 'Could not load this company.')));
  }, []);

  const elsewhere =
    Boolean(current?.connected) &&
    Boolean(ask) &&
    current?.askmira_workspace_id !== ask?.tenant_id.toLowerCase();

  async function allow(): Promise<void> {
    if (!ask) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await apiFetch<{ redirect_to: string }>('/integrations/askmira/connect/approve', {
        method: 'POST',
        body: JSON.stringify(ask),
      });
      window.location.assign(answer.redirect_to);
    } catch (err: unknown) {
      setError(messageOf(err, 'Could not connect. Try again.'));
      setBusy(false);
    }
  }

  async function disconnect(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setCurrent(await apiFetch<Connection>('/integrations/askmira/connection', { method: 'DELETE' }));
    } catch (err: unknown) {
      setError(messageOf(err, 'Could not disconnect. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Connect AskMira"
        description="AskMira is your company's HR system. Connecting lets your people use ProcureFlow from it."
      />
      <Card className="space-y-4 p-6">
        {ask === undefined || (!current && !error) ? (
          <p className="text-body-sm text-muted">Loading…</p>
        ) : (
          <>
            <p className="text-body text-text">
              {ask ? (
                <>
                  The AskMira workspace <strong>{ask.tenant_name}</strong>
                  {originOf(ask.redirect_uri) ? <> at {originOf(ask.redirect_uri)}</> : null} wants to
                  connect to <strong>{current?.workspace.name ?? 'this company'}</strong>.
                </>
              ) : current?.connected ? (
                <>
                  <strong>{current.workspace.name}</strong> is connected to the AskMira workspace{' '}
                  {current.askmira_workspace}.
                </>
              ) : (
                <>Not connected to AskMira. Start from Settings → Connectors in AskMira.</>
              )}
            </p>
            {ask ? (
              <ul className="list-disc space-y-1 pl-5 text-body-sm text-muted">
                {GRANTS.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            ) : null}
            {current && !current.can_connect ? (
              <p role="alert" className="text-body-sm text-danger">
                This ProcureFlow is not set up to connect to AskMira yet. Ask the person who runs it.
              </p>
            ) : null}
            {elsewhere ? (
              <p role="alert" className="text-body-sm text-danger">
                This company is already connected to the AskMira workspace {current?.askmira_workspace}.
                Disconnect it first to connect another.
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-body-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {ask && !elsewhere && current?.can_connect ? (
                <Button variant="primary" onClick={allow} disabled={busy}>
                  {busy ? 'Please wait…' : 'Allow AskMira to connect'}
                </Button>
              ) : null}
              {current?.connected ? (
                <Button variant="secondary" onClick={disconnect} disabled={busy}>
                  Disconnect AskMira
                </Button>
              ) : null}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
