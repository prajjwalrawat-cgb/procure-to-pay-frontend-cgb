'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
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
} from '@procureflow/shared';

import { apiFetch } from '@/lib/api-client';

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
): UseQueryResult<PaymentRunListResponse> {
  return useQuery({
    queryKey: paymentKeys.list(tab),
    queryFn: () => apiFetch<PaymentRunListResponse>(`/payment-runs?tab=${tab}&limit=50`),
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
