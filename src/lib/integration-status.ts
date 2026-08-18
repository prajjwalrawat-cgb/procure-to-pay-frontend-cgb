'use client';

/**
 * Is a given integration answering for real, or from a sandbox?
 *
 * Some API responses carry an explicit `simulated` flag (GSTR-2B recon, IRN
 * validation, payment UTRs). Others do not — notably the invoice's stored
 * `compliance.gstinStatus` / `gstr2bStatus`, which are plain strings with no
 * provenance attached. Those screens still must not render a confident green
 * "ACTIVE" for a mock verdict, so provenance is inferred here.
 *
 * ── Why credential status alone is not enough ──────────────────────────────
 * The obvious inference — "configured && isActive means live" — is wrong, and
 * wrong in the dangerous direction. A tenant can have a credential configured
 * that is itself a sandbox key (the seeded demo tenant has exactly this: GSP
 * shows `configured` with the label "Star Cement GSP (sandbox)", while every
 * recorded GSP call comes back simulated). Trusting `configured` alone renders
 * a green MATCHED for a mock reconciliation.
 *
 * So the primary signal is behavioural, from `/integrations/usage`: a provider
 * counts as live only if it has actually recorded calls this month AND not all
 * of them were simulated. `configured && isActive` is kept as a necessary
 * precondition, not a sufficient one.
 *
 * ── Fail closed ────────────────────────────────────────────────────────────
 * Loading, missing provider, zero recorded calls, or an errored request all
 * report NOT live, so the UI shows a sandbox marker. Marking real data as
 * sandbox is a small annoyance; marking sandbox data as real is the failure
 * this mechanism exists to prevent.
 *
 * This remains a client-side inference. The durable fix is a `simulated` flag
 * on the invoice compliance block itself — see docs/ui-refresh-log.md, "API
 * gaps".
 */

import type { IntegrationProvider } from '@/lib/shared';

import { useCredentialStatus, useIntegrationUsage } from '@/lib/api/integrations';

/** Current month as the API's `YYYY-MM`. */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface ProviderLiveness {
  /** True only when the provider is configured, active, and demonstrably live. */
  isLive: (provider: IntegrationProvider) => boolean;
  /** Convenience inverse — reads better at the call site. */
  isSimulated: (provider: IntegrationProvider) => boolean;
  isLoading: boolean;
}

export function useProviderLiveness(): ProviderLiveness {
  const { data: creds, isLoading: loadingCreds } = useCredentialStatus();
  const { data: usage, isLoading: loadingUsage } = useIntegrationUsage(currentMonth());

  const isLive = (provider: IntegrationProvider): boolean => {
    if (!creds || !usage) return false; // fail closed while loading or on error

    // Necessary precondition: somebody has wired this provider up at all.
    const cred = creds.find((c) => c.provider === provider);
    if (!cred?.configured || !cred.isActive) return false;

    // Sufficient evidence: at least one real, non-simulated call on record.
    const rows = usage.rows.filter((r) => r.provider === provider);
    const calls = rows.reduce((n, r) => n + r.calls, 0);
    const simulated = rows.reduce((n, r) => n + r.simulatedCalls, 0);
    return calls > 0 && simulated < calls;
  };

  return {
    isLive,
    isSimulated: (p) => !isLive(p),
    isLoading: loadingCreds || loadingUsage,
  };
}

/**
 * Which provider stands behind each compliance field on an invoice. Kept here
 * so the mapping is stated once rather than guessed at per screen.
 */
export const COMPLIANCE_PROVIDER = {
  gstin: 'GSTN',
  gstr2b: 'GSP',
  irn: 'GSP',
  ewaybill: 'GSP',
} as const satisfies Record<string, IntegrationProvider>;
