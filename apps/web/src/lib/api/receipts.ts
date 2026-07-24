'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  GrnCompleteQcInput,
  GrnCreateInput,
  GrnDetailResponse,
  GrnListResponse,
  GrnQcSampleInput,
  PoListResponse,
} from '@procureflow/shared';

import { apiFetch } from '@/lib/api-client';

export type GrnTab = 'pending_receipt' | 'awaiting_qc' | 'posted_today' | 'held' | 'all';

export const grnKeys = {
  all: ['receipts'] as const,
  list: (tab: GrnTab) => ['receipts', 'list', tab] as const,
  detail: (id: string) => ['receipts', 'detail', id] as const,
  pendingPos: ['receipts', 'pending-pos'] as const,
};

export function useReceipts(tab: GrnTab): UseQueryResult<GrnListResponse> {
  return useQuery({
    queryKey: grnKeys.list(tab),
    queryFn: () => apiFetch<GrnListResponse>(`/grn?tab=${tab}`),
  });
}

export function useReceipt(id: string): UseQueryResult<GrnDetailResponse> {
  return useQuery({
    queryKey: grnKeys.detail(id),
    queryFn: () => apiFetch<GrnDetailResponse>(`/grn/${id}`),
    enabled: !!id,
  });
}

/** POs awaiting a receipt (issued/acknowledged/partially received). */
export function usePendingReceiptPos(): UseQueryResult<PoListResponse> {
  return useQuery({
    queryKey: grnKeys.pendingPos,
    queryFn: () => apiFetch<PoListResponse>('/purchase-orders?tab=awaiting_grn'),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string): void {
  if (id) void qc.invalidateQueries({ queryKey: grnKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: grnKeys.all });
  void qc.invalidateQueries({ queryKey: ['purchase-orders'] });
  void qc.invalidateQueries({ queryKey: ['requisitions'] });
}

export function useCreateReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GrnCreateInput) =>
      apiFetch<{ id: string }>('/grn', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useSubmitReceipt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/grn/${id}/submit`, { method: 'POST' }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useStartQc(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/grn/${id}/start-qc`, { method: 'POST' }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useRecordSample(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GrnQcSampleInput) =>
      apiFetch<{ id: string; result: string }>(`/grn/${id}/samples`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useCompleteQc(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GrnCompleteQcInput) =>
      apiFetch(`/grn/${id}/complete-qc`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function usePostReceipt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/grn/${id}/post`, { method: 'POST' }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useReverseReceipt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch(`/grn/${id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useAddReceiptAttachment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { s3Key: string; docType: string }) =>
      apiFetch<{ id: string }>(`/grn/${id}/attachments`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidate(qc, id),
  });
}
