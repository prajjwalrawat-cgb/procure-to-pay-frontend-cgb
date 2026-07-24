'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { CostCenterRef, PlantRef, VendorRef } from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';

/** Tenant-scoped procurement reference lists (Slice 4 wizard pickers). */
export const refKeys = {
  costCenters: () => ['refs', 'cost-centers'] as const,
  plants: () => ['refs', 'plants'] as const,
  vendors: () => ['refs', 'vendors'] as const,
};

const STALE = 5 * 60 * 1000;

export function useCostCenters(): UseQueryResult<{ items: CostCenterRef[] }> {
  return useQuery({
    queryKey: refKeys.costCenters(),
    queryFn: () => apiFetch<{ items: CostCenterRef[] }>('/cost-centers'),
    staleTime: STALE,
  });
}

export function usePlants(): UseQueryResult<{ items: PlantRef[] }> {
  return useQuery({
    queryKey: refKeys.plants(),
    queryFn: () => apiFetch<{ items: PlantRef[] }>('/plants'),
    staleTime: STALE,
  });
}

export function useVendors(): UseQueryResult<{ items: VendorRef[] }> {
  return useQuery({
    queryKey: refKeys.vendors(),
    queryFn: () => apiFetch<{ items: VendorRef[] }>('/refs/vendors'),
    staleTime: STALE,
  });
}
