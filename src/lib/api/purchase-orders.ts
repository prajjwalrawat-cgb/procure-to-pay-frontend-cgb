'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  PoAttachmentType,
  PoAttachmentView,
  PoCreateInput,
  PoDecisionInput,
  PoUpdateInput,
  PoDetailResponse,
  PoListResponse,
  PoTermInput,
  PoTermView,
} from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';
import { fetchAllPages, type AllPages } from '@/lib/api/paginate';

export type PoTab = 'open' | 'partial' | 'awaiting_grn' | 'closed' | 'cancelled';

export const poKeys = {
  all: ['purchase-orders'] as const,
  list: (tab: PoTab) => ['purchase-orders', 'list', tab] as const,
  detail: (id: string) => ['purchase-orders', 'detail', id] as const,
};

export function usePurchaseOrders(tab: PoTab): UseQueryResult<AllPages<PoListResponse>> {
  return useQuery({
    queryKey: poKeys.list(tab),
    queryFn: () => fetchAllPages<PoListResponse>(`/purchase-orders?tab=${tab}`),
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

/** Draft-only edits. Changing the bill-to branch re-derives the place of
 *  supply server-side, so the detail view is re-read on success. */
export function useUpdatePo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PoUpdateInput) =>
      apiFetch(`/purchase-orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidate(qc, id),
  });
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

// ── Supporting documents (buyer-side only) ──────────────────────────────────

/*
 * These three take `poId` in the mutation payload rather than as a hook
 * argument: the spot-buy wizard only learns the id once the PO has been
 * created, and a hook cannot be constructed mid-submit.
 */

/**
 * Multipart, so no JSON Content-Type: `apiFetch` detects FormData and lets the
 * browser set the multipart boundary itself.
 */
export function useUploadPoAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      poId: string;
      file: File;
      docType: PoAttachmentType;
      note?: string;
    }) => {
      const form = new FormData();
      form.append('file', input.file);
      form.append('docType', input.docType);
      if (input.note) form.append('note', input.note);
      return apiFetch<PoAttachmentView>(
        `/purchase-orders/${input.poId}/attachments/upload`,
        { method: 'POST', body: form },
      );
    },
    onSuccess: (_data, v) => qc.invalidateQueries({ queryKey: poKeys.detail(v.poId) }),
  });
}

export function useRemovePoAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { poId: string; attachmentId: string }) =>
      apiFetch<{ ok: true }>(
        `/purchase-orders/${input.poId}/attachments/${input.attachmentId}`,
        { method: 'DELETE' },
      ),
    onSuccess: (_data, v) => qc.invalidateQueries({ queryKey: poKeys.detail(v.poId) }),
  });
}

// ── Terms & conditions ──────────────────────────────────────────────────────

/** Replaces the whole set — array order becomes the order printed on the PDF. */
export function useSetPoTerms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { poId: string; terms: PoTermInput[] }) =>
      apiFetch<PoTermView[]>(`/purchase-orders/${input.poId}/terms`, {
        method: 'PUT',
        body: JSON.stringify({ terms: input.terms }),
      }),
    onSuccess: (_data, v) => qc.invalidateQueries({ queryKey: poKeys.detail(v.poId) }),
  });
}
