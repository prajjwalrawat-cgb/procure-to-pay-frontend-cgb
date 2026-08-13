'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  BudgetCheckResult,
  ItemListResponse,
  RequisitionAttachmentType,
  RequisitionAttachmentView,
  RequisitionCreateInput,
  RequisitionDecisionInput,
  RequisitionDetailResponse,
  RequisitionKanbanResponse,
  RequisitionListResponse,
  RequisitionUpdateInput,
} from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';

export type RequisitionTab = 'active' | 'my_approval' | 'draft' | 'rejected' | 'closed';

export const requisitionKeys = {
  all: ['requisitions'] as const,
  board: () => ['requisitions', 'board'] as const,
  list: (tab: RequisitionTab) => ['requisitions', 'list', tab] as const,
  detail: (id: string) => ['requisitions', 'detail', id] as const,
  budget: (costCenterId: string, amount: string) =>
    ['budget', costCenterId, amount] as const,
  items: (q: string) => ['items', q] as const,
};

export function useRequisitionBoard(): UseQueryResult<RequisitionKanbanResponse> {
  return useQuery({
    queryKey: requisitionKeys.board(),
    queryFn: () => apiFetch<RequisitionKanbanResponse>('/requisitions/board'),
  });
}

export function useRequisitionList(
  tab: RequisitionTab,
): UseQueryResult<RequisitionListResponse> {
  return useQuery({
    queryKey: requisitionKeys.list(tab),
    queryFn: () => apiFetch<RequisitionListResponse>(`/requisitions?tab=${tab}&limit=50`),
  });
}

export function useRequisition(id: string): UseQueryResult<RequisitionDetailResponse> {
  return useQuery({
    queryKey: requisitionKeys.detail(id),
    queryFn: () => apiFetch<RequisitionDetailResponse>(`/requisitions/${id}`),
  });
}

export function useBudgetCheck(
  costCenterId: string | null,
  amount: string,
): UseQueryResult<BudgetCheckResult> {
  return useQuery({
    queryKey: requisitionKeys.budget(costCenterId ?? '', amount),
    queryFn: () =>
      apiFetch<BudgetCheckResult>(
        `/cost-centers/${costCenterId}/budget?amount=${encodeURIComponent(amount)}`,
      ),
    enabled: Boolean(costCenterId),
    retry: false,
    staleTime: 30_000,
  });
}

export function useItemSearch(q: string): UseQueryResult<ItemListResponse> {
  return useQuery({
    queryKey: requisitionKeys.items(q),
    queryFn: () =>
      apiFetch<ItemListResponse>(`/items?q=${encodeURIComponent(q)}&limit=20`),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  });
}

export function useCreateRequisition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RequisitionCreateInput) =>
      apiFetch<{ id: string }>('/requisitions', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: requisitionKeys.all }),
  });
}

export function useUpdateRequisition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RequisitionUpdateInput) =>
      apiFetch<{ ok: true }>(`/requisitions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: requisitionKeys.detail(id) }),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id: string): void {
  void qc.invalidateQueries({ queryKey: requisitionKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: requisitionKeys.all });
}

export function useSubmitRequisition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/requisitions/${id}/submit`, { method: 'POST' }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useWithdrawRequisition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch(`/requisitions/${id}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useCancelRequisition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch(`/requisitions/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useDecideRequisition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RequisitionDecisionInput) =>
      apiFetch(`/requisitions/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      invalidate(qc, id);
      void qc.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

// ── Attachments ──────────────────────────────────────────────────────────────

export interface StagedAttachment {
  file: File;
  docType: RequisitionAttachmentType;
  note?: string | null;
}

/**
 * Uploads one document. The API caps each request at a single file, so a
 * multi-file selection is sent as one call per file.
 */
export async function uploadRequisitionAttachment(
  requisitionId: string,
  staged: StagedAttachment,
): Promise<RequisitionAttachmentView> {
  const form = new FormData();
  form.append('file', staged.file);
  form.append('docType', staged.docType);
  if (staged.note) form.append('note', staged.note);
  return apiFetch<RequisitionAttachmentView>(
    `/requisitions/${requisitionId}/attachments/upload`,
    { method: 'POST', body: form },
  );
}

export function useUploadRequisitionAttachment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (staged: StagedAttachment) => uploadRequisitionAttachment(id, staged),
    onSuccess: () => qc.invalidateQueries({ queryKey: requisitionKeys.detail(id) }),
  });
}

export function useDeleteRequisitionAttachment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      apiFetch<{ ok: true }>(`/requisitions/${id}/attachments/${attachmentId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: requisitionKeys.detail(id) }),
  });
}

export function useAddRequisitionComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<{ id: string }>(`/requisitions/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: requisitionKeys.detail(id) }),
  });
}
