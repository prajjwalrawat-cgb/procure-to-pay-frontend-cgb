'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  VendorPoDetailResponse,
  VendorPoListResponse,
  VendorPoQueryInput,
} from '@/lib/shared';

import { apiFetch } from '@/vendor/lib/api-client';

export function useVendorPos(): UseQueryResult<VendorPoListResponse> {
  return useQuery({
    queryKey: ['vendor', 'purchase-orders'],
    queryFn: () => apiFetch<VendorPoListResponse>('/vendor/purchase-orders'),
  });
}

export function useVendorPo(id: string): UseQueryResult<VendorPoDetailResponse> {
  return useQuery({
    queryKey: ['vendor', 'purchase-orders', id],
    queryFn: () => apiFetch<VendorPoDetailResponse>(`/vendor/purchase-orders/${id}`),
    enabled: id.length > 0,
  });
}

export function useAcknowledgePo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ acknowledgedAt: string }>(`/vendor/purchase-orders/${id}/acknowledge`, {
        method: 'POST',
      }),
    // Whether we acked now or it was already acked (409), refetch to reflect it.
    onSettled: () =>
      qc.invalidateQueries({ queryKey: ['vendor', 'purchase-orders', id] }),
  });
}

export function useRaisePoQuery(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VendorPoQueryInput) =>
      apiFetch<{ id: string }>(`/vendor/purchase-orders/${id}/query`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['vendor', 'purchase-orders', id] }),
  });
}
