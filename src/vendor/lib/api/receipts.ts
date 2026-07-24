'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { VendorGrnListResponse, VendorRmaListResponse } from '@/lib/shared';

import { apiFetch } from '@/vendor/lib/api-client';

export function useVendorGrns(): UseQueryResult<VendorGrnListResponse> {
  return useQuery({
    queryKey: ['vendor', 'grn'],
    queryFn: () => apiFetch<VendorGrnListResponse>('/vendor/grn'),
  });
}

export function useVendorRmas(): UseQueryResult<VendorRmaListResponse> {
  return useQuery({
    queryKey: ['vendor', 'rma'],
    queryFn: () => apiFetch<VendorRmaListResponse>('/vendor/rma'),
  });
}

export function useScheduleRmaPickup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pickupAt: string) =>
      apiFetch(`/vendor/rma/${id}/schedule-pickup`, {
        method: 'POST',
        body: JSON.stringify({ pickupAt }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor', 'rma'] }),
  });
}
