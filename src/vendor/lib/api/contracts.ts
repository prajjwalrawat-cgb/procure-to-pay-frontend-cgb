'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type {
  VendorContractDetailResponse,
  VendorContractListItem,
} from '@/lib/shared';

import { apiFetch } from '@/vendor/lib/api-client';

export function useVendorContracts(): UseQueryResult<VendorContractListItem[]> {
  return useQuery({
    queryKey: ['vendor', 'contracts'],
    queryFn: () => apiFetch<VendorContractListItem[]>('/vendor/contracts'),
  });
}

export function useVendorContract(
  id: string,
): UseQueryResult<VendorContractDetailResponse> {
  return useQuery({
    queryKey: ['vendor', 'contracts', id],
    queryFn: () => apiFetch<VendorContractDetailResponse>(`/vendor/contracts/${id}`),
    enabled: id.length > 0,
  });
}
