'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  RmaCreditNoteInput,
  RmaDetailResponse,
  RmaListResponse,
  RmaPickupInput,
  RmaUpdateInput,
} from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';

export type RmaTab =
  'draft' | 'issued' | 'awaiting_pickup' | 'awaiting_credit_note' | 'closed' | 'all';

export const rmaKeys = {
  all: ['rma'] as const,
  list: (tab: RmaTab) => ['rma', 'list', tab] as const,
  detail: (id: string) => ['rma', 'detail', id] as const,
};

export function useRmas(tab: RmaTab): UseQueryResult<RmaListResponse> {
  return useQuery({
    queryKey: rmaKeys.list(tab),
    queryFn: () => apiFetch<RmaListResponse>(`/rma?tab=${tab}`),
  });
}

export function useRma(id: string): UseQueryResult<RmaDetailResponse> {
  return useQuery({
    queryKey: rmaKeys.detail(id),
    queryFn: () => apiFetch<RmaDetailResponse>(`/rma/${id}`),
    enabled: !!id,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id: string): void {
  void qc.invalidateQueries({ queryKey: rmaKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: rmaKeys.all });
}

export function useUpdateRma(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RmaUpdateInput) =>
      apiFetch(`/rma/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useIssueRma(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/rma/${id}/issue`, { method: 'POST' }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useRecordRmaPickup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RmaPickupInput) =>
      apiFetch(`/rma/${id}/pickup`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useRecordCreditNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RmaCreditNoteInput) =>
      apiFetch(`/rma/${id}/credit-note`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useCloseRma(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/rma/${id}/close`, { method: 'POST' }),
    onSuccess: () => invalidate(qc, id),
  });
}
