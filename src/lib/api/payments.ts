'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  BankAccountInput,
  BankAccountView,
  BankConfirmationResult,
  BankReconciliationResponse,
  CreatePaymentRunInput,
  MsmeAuditResult,
  PaymentRunDetailResponse,
  PaymentRunListResponse,
  ReorderPaymentItemsInput,
  SuggestInvoicesInput,
  SuggestInvoicesResponse,
} from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';
import { fetchAllPages, type AllPages } from '@/lib/api/paginate';

export type PaymentRunTab =
  'all' | 'draft' | 'awaiting' | 'submitted' | 'completed' | 'failed';

export const paymentKeys = {
  all: ['payment-runs'] as const,
  list: (tab: PaymentRunTab) => ['payment-runs', 'list', tab] as const,
  detail: (id: string) => ['payment-runs', 'detail', id] as const,
  banks: () => ['bank-accounts'] as const,
};

export function usePaymentRuns(
  tab: PaymentRunTab,
): UseQueryResult<AllPages<PaymentRunListResponse>> {
  return useQuery({
    queryKey: paymentKeys.list(tab),
    queryFn: () => fetchAllPages<PaymentRunListResponse>(`/payment-runs?tab=${tab}`),
  });
}

export function usePaymentRun(id: string): UseQueryResult<PaymentRunDetailResponse> {
  return useQuery({
    queryKey: paymentKeys.detail(id),
    queryFn: () => apiFetch<PaymentRunDetailResponse>(`/payment-runs/${id}`),
    refetchInterval: 15_000,
  });
}

export function useBankAccounts(): UseQueryResult<{ items: BankAccountView[] }> {
  return useQuery({
    queryKey: paymentKeys.banks(),
    queryFn: () => apiFetch<{ items: BankAccountView[] }>('/bank-accounts'),
  });
}

// ── Bank account administration (Settings → Bank accounts) ─────────────────
// Retired accounts are included here but not in the picker above, so a run can
// only ever be raised against a live account.

export function useAllBankAccounts(): UseQueryResult<{ items: BankAccountView[] }> {
  return useQuery({
    queryKey: [...paymentKeys.banks(), 'all'],
    queryFn: () => apiFetch<{ items: BankAccountView[] }>('/bank-accounts/all'),
  });
}

/** Every mutation returns the full list, so the cache is replaced whole. */
function useBankAccountMutation<TArgs>(
  fn: (args: TArgs) => Promise<{ items: BankAccountView[] }>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData([...paymentKeys.banks(), 'all'], data);
      // The run picker shows only active accounts, so it has to be re-read.
      void qc.invalidateQueries({ queryKey: paymentKeys.banks() });
    },
  });
}

export const useCreateBankAccount = () =>
  useBankAccountMutation((body: BankAccountInput) =>
    apiFetch<{ items: BankAccountView[] }>('/bank-accounts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );

export const useUpdateBankAccount = () =>
  useBankAccountMutation((v: { id: string; body: BankAccountInput }) =>
    apiFetch<{ items: BankAccountView[] }>(`/bank-accounts/${v.id}`, {
      method: 'PUT',
      body: JSON.stringify(v.body),
    }),
  );

export const useSetBankAccountActive = () =>
  useBankAccountMutation((v: { id: string; isActive: boolean }) =>
    apiFetch<{ items: BankAccountView[] }>(`/bank-accounts/${v.id}/active`, {
      method: 'POST',
      body: JSON.stringify({ isActive: v.isActive }),
    }),
  );

export function useCreatePaymentRun() {
  return useMutation({
    mutationFn: (body: CreatePaymentRunInput) =>
      apiFetch<{ id: string }>('/payment-runs', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

function invalidateDetail(qc: ReturnType<typeof useQueryClient>, id: string): void {
  void qc.invalidateQueries({ queryKey: paymentKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: paymentKeys.all });
}

export function useSuggestInvoices(runId: string) {
  return useMutation({
    mutationFn: (body: SuggestInvoicesInput) =>
      apiFetch<SuggestInvoicesResponse>(`/payment-runs/${runId}/suggest`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

export function useAddPaymentItem(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      apiFetch(`/payment-runs/${runId}/items`, {
        method: 'POST',
        body: JSON.stringify({ invoiceId }),
      }),
    onSuccess: () => invalidateDetail(qc, runId),
  });
}

export function useRemovePaymentItem(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      apiFetch(`/payment-runs/${runId}/items/${invoiceId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateDetail(qc, runId),
  });
}

/** Pay part of an invoice in this run; the rest stays payable for a later one. */
export function useSetPaymentItemAmount(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { invoiceId: string; amount: string }) =>
      apiFetch(`/payment-runs/${runId}/items/${vars.invoiceId}/amount`, {
        method: 'PUT',
        body: JSON.stringify({ amount: vars.amount }),
      }),
    onSuccess: () => invalidateDetail(qc, runId),
  });
}

export function useReorderItems(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReorderPaymentItemsInput) =>
      apiFetch(`/payment-runs/${runId}/reorder`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateDetail(qc, runId),
  });
}

export function useSubmitForApproval(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/payment-runs/${runId}/submit-for-approval`, { method: 'POST' }),
    onSuccess: () => invalidateDetail(qc, runId),
  });
}

export function useDecidePaymentRun(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      approvalId: string;
      decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
      comment?: string;
    }) =>
      apiFetch(`/payment-runs/${runId}/decide`, {
        method: 'POST',
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      invalidateDetail(qc, runId);
      void qc.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useCancelPaymentRun(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch(`/payment-runs/${runId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => invalidateDetail(qc, runId),
  });
}

export function useMsmeAudit(runId: string): UseQueryResult<MsmeAuditResult> {
  return useQuery({
    queryKey: [...paymentKeys.detail(runId), 'msme-audit'],
    queryFn: () => apiFetch<MsmeAuditResult>(`/payment-runs/${runId}/msme-audit`),
  });
}

// ── Slice 10b — bank reconciliation ──────────────────────────────────────────

export function useReconciliation(runId: string) {
  return useQuery({
    queryKey: ['payment-runs', 'reconciliation', runId],
    queryFn: () =>
      apiFetch<BankReconciliationResponse>(`/payment-runs/${runId}/reconciliation`),
    enabled: runId.length > 0,
  });
}

export function useConfirmBank(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<BankConfirmationResult>(`/payment-runs/${runId}/confirm-bank`, {
        method: 'POST',
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payment-runs'] }),
  });
}

export function useRetryFailedItems(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ retried: number }>(`/payment-runs/${runId}/retry`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payment-runs'] }),
  });
}
