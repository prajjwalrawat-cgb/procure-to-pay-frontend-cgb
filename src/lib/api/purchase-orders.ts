'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  PoCreateInput,
  PoDecisionInput,
  PoDetailResponse,
  PoListResponse,
} from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';

export type PoTab = 'open' | 'partial' | 'awaiting_grn' | 'closed' | 'cancelled';

export const poKeys = {
  all: ['purchase-orders'] as const,
  list: (tab: PoTab) => ['purchase-orders', 'list', tab] as const,
  detail: (id: string) => ['purchase-orders', 'detail', id] as const,
};

export function usePurchaseOrders(tab: PoTab): UseQueryResult<PoListResponse> {
  return useQuery({
    queryKey: poKeys.list(tab),
    queryFn: () => apiFetch<PoListResponse>(`/purchase-orders?tab=${tab}`),
  });
}

export function usePurchaseOrder(id: string): UseQueryResult<PoDetailResponse> {
  return useQuery({
    queryKey: poKeys.detail(id),
    queryFn: () => apiFetch<PoDetailResponse>(`/purchase-orders/${id}`),
    // Guard against an empty id hitting the list endpoint (which returns a
    // list-shaped object with no `.vendor`) — see /goods-receipt/new.
    enabled: id.length > 0,
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PoCreateInput) =>
      apiFetch<{ id: string }>('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: poKeys.all }),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id: string): void {
  void qc.invalidateQueries({ queryKey: poKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: poKeys.all });
}

export function useSubmitPo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/purchase-orders/${id}/submit`, { method: 'POST' }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useDecidePo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PoDecisionInput) =>
      apiFetch(`/purchase-orders/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      invalidate(qc, id);
      void qc.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useIssuePo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/purchase-orders/${id}/issue`, { method: 'POST' }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useCancelPo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch(`/purchase-orders/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useHoldPo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch(`/purchase-orders/${id}/hold`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useAddPoComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<{ id: string }>(`/purchase-orders/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: poKeys.detail(id) }),
  });
}
