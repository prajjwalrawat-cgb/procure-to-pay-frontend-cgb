'use client';

import { useMutation, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type {
  BoxDetailResponse,
  BoxListItem,
  BoxMoveResponse,
  ProductWhereResponse,
} from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';

export const boxKeys = {
  byBarcode: (barcode: string) => ['box', 'barcode', barcode] as const,
  detail: (id: string) => ['box', id] as const,
  list: (q: Record<string, unknown>) => ['box', 'list', q] as const,
  where: (productId: string) => ['product', productId, 'where'] as const,
};

/**
 * Scan a box label → what it is, where it is, and everything inside it.
 *
 * Not cached: an operator scans a box precisely because they want to know what
 * is in it *now*, and a stale contents list is worse than a slow one.
 */
export function useBoxByBarcode(barcode: string): UseQueryResult<BoxDetailResponse> {
  return useQuery({
    queryKey: boxKeys.byBarcode(barcode),
    queryFn: () =>
      apiFetch<BoxDetailResponse>(`/boxes/by-barcode/${encodeURIComponent(barcode)}`),
    enabled: barcode.length > 0,
    staleTime: 0,
    gcTime: 0,
  });
}

/** "Where exactly is this product physically stored?" */
export function useProductWhere(productId: string): UseQueryResult<ProductWhereResponse> {
  return useQuery({
    queryKey: boxKeys.where(productId),
    queryFn: () =>
      apiFetch<ProductWhereResponse>(`/inventory/products/${productId}/where`),
    enabled: productId.length > 0,
  });
}

export function useBoxes(
  params: { q?: string; locationId?: string; productId?: string } = {},
): UseQueryResult<{ items: BoxListItem[] }> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, String(v));
  const qs = search.toString();

  return useQuery({
    queryKey: boxKeys.list(params),
    queryFn: () => apiFetch<{ items: BoxListItem[] }>(`/boxes${qs ? `?${qs}` : ''}`),
  });
}

/** Move a box, and everything in it, to another section. */
export function useMoveBox() {
  return useMutation({
    mutationFn: (body: {
      boxBarcodeRaw: string;
      toBinBarcodeRaw: string;
      remark?: string;
    }) =>
      apiFetch<BoxMoveResponse>('/boxes/move', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

/** Move loose stock at a location into a box standing there. */
export function usePackBox() {
  return useMutation({
    mutationFn: (body: {
      boxBarcodeRaw: string;
      barcodeRaw: string;
      quantity: number;
      batchNumber?: string | null;
    }) =>
      apiFetch<BoxMoveResponse>('/boxes/pack', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

/** Take stock out of a box, leaving it loose at the same location. */
export function useUnpackBox() {
  return useMutation({
    mutationFn: (body: {
      boxBarcodeRaw: string;
      barcodeRaw: string;
      quantity: number;
      batchNumber?: string | null;
    }) =>
      apiFetch<BoxMoveResponse>('/boxes/unpack', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}
