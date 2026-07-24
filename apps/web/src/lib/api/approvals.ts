'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  ApprovalMatrixCreateInput,
  ApprovalMatrixListResponse,
  ApprovalMatrixUpdateInput,
  ApprovalMatrixView,
  DocumentType,
  SimulateInput,
  SimulateResult,
} from '@procureflow/shared';

import { apiFetch } from '@/lib/api-client';

export const approvalKeys = {
  all: ['approvals'] as const,
  matrices: (docType: DocumentType) => ['approvals', 'matrices', docType] as const,
  versions: (id: string) => ['approvals', 'versions', id] as const,
};

export function useMatrices(
  docType: DocumentType,
): UseQueryResult<ApprovalMatrixListResponse> {
  return useQuery({
    queryKey: approvalKeys.matrices(docType),
    queryFn: () =>
      apiFetch<ApprovalMatrixListResponse>(`/approvals/matrices?documentType=${docType}`),
  });
}

export function useMatrixVersions(
  id: string | null,
): UseQueryResult<ApprovalMatrixView[]> {
  return useQuery({
    queryKey: approvalKeys.versions(id ?? ''),
    queryFn: () => apiFetch<ApprovalMatrixView[]>(`/approvals/matrices/${id}/versions`),
    enabled: Boolean(id),
  });
}

export function useCreateMatrix(docType: DocumentType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ApprovalMatrixCreateInput) =>
      apiFetch<ApprovalMatrixView>('/approvals/matrices', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: approvalKeys.matrices(docType) }),
  });
}

export function useUpdateMatrix(docType: DocumentType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; input: ApprovalMatrixUpdateInput }) =>
      apiFetch<ApprovalMatrixView>(`/approvals/matrices/${vars.id}`, {
        method: 'PATCH',
        body: JSON.stringify(vars.input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: approvalKeys.matrices(docType) }),
  });
}

export function useMatrixAction(docType: DocumentType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; action: 'activate' | 'deactivate' | 'duplicate' }) =>
      apiFetch<ApprovalMatrixView>(`/approvals/matrices/${vars.id}/${vars.action}`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: approvalKeys.matrices(docType) }),
  });
}

export async function simulateRule(input: SimulateInput): Promise<SimulateResult> {
  return apiFetch<SimulateResult>('/approvals/simulate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
