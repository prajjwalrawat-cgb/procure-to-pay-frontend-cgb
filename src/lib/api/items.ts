'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  ItemCreateInput,
  ItemDetailResponse,
  ItemListResponse,
  ItemUpdateInput,
} from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';

export interface ItemListFilters {
  q?: string;
  category?: string;
  /** Only ever `true` — see the note in `buildQuery`. */
  activeOnly?: boolean;
  limit?: number;
}

export const itemKeys = {
  all: ['item-master'] as const,
  list: (f: ItemListFilters) => ['item-master', 'list', f] as const,
  detail: (id: string) => ['item-master', 'detail', id] as const,
};

/**
 * The API parses `active` with `z.coerce.boolean()`, which is `Boolean(input)` —
 * so the string "false" coerces to *true* and would silently return the active
 * items. We therefore only ever send `active=true`; "inactive only" is filtered
 * client-side on the page.
 */
function buildQuery(f: ItemListFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.category) p.set('category', f.category);
  if (f.activeOnly) p.set('active', 'true');
  p.set('limit', String(f.limit ?? 200));
  return p.toString();
}

export function useItems(f: ItemListFilters = {}): UseQueryResult<ItemListResponse> {
  return useQuery({
    queryKey: itemKeys.list(f),
    queryFn: () => apiFetch<ItemListResponse>(`/items?${buildQuery(f)}`),
    staleTime: 30_000,
  });
}

export function useItem(id: string | null): UseQueryResult<ItemDetailResponse> {
  return useQuery({
    queryKey: itemKeys.detail(id ?? ''),
    queryFn: () => apiFetch<ItemDetailResponse>(`/items/${id}`),
    enabled: Boolean(id),
  });
}

/** Item edits change what the requisition line picker offers, so bust that too. */
function invalidateItems(qc: ReturnType<typeof useQueryClient>, id?: string): void {
  void qc.invalidateQueries({ queryKey: itemKeys.all });
  void qc.invalidateQueries({ queryKey: ['items'] });
  if (id) void qc.invalidateQueries({ queryKey: itemKeys.detail(id) });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ItemCreateInput) =>
      apiFetch<{ id: string }>('/items', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateItems(qc),
  });
}

export function useUpdateItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ItemUpdateInput) =>
      apiFetch<{ ok: true }>(`/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateItems(qc, id),
  });
}

export function useDeactivateItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true }>(`/items/${id}/deactivate`, { method: 'POST' }),
    onSuccess: () => invalidateItems(qc, id),
  });
}
