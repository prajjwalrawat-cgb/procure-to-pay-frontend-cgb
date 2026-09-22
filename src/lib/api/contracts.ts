'use client';

import type {
  AcknowledgeAlertInput,
  AmendmentInput,
  CallOffInput,
  ClauseLibraryInput,
  ClauseLibraryItem,
  ContractCreateInput,
  ContractDetailResponse,
  ContractListResponse,
  ContractTab,
  EscalationProposalResponse,
  RenewalCalendarResponse,
  TerminateInput,
  VolumeTrackingView,
} from '@/lib/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { fetchAllPages } from '@/lib/api/paginate';

export const contractKeys = {
  all: ['contracts'] as const,
  list: (tab: string) => ['contracts', 'list', tab] as const,
  detail: (id: string) => ['contracts', 'detail', id] as const,
  volume: (id: string) => ['contracts', 'volume', id] as const,
  renewals: ['contracts', 'renewals'] as const,
  library: (t: string) => ['contracts', 'clause-library', t] as const,
};

export const useContracts = (tab: ContractTab) =>
  useQuery({
    queryKey: contractKeys.list(tab),
    queryFn: () => apiFetch<ContractListResponse>(`/contracts?tab=${tab}`),
  });

/** Every contract in a tab (the list sorts and filters client-side). */
export const useAllContracts = (tab: ContractTab) =>
  useQuery({
    queryKey: [...contractKeys.list(tab), 'all-pages'],
    queryFn: () => fetchAllPages<ContractListResponse>(`/contracts?tab=${tab}`),
  });

export const useContract = (id: string) =>
  useQuery({
    queryKey: contractKeys.detail(id),
    queryFn: () => apiFetch<ContractDetailResponse>(`/contracts/${id}`),
    enabled: Boolean(id),
  });

export const useVolumeTracking = (id: string) =>
  useQuery({
    queryKey: contractKeys.volume(id),
    queryFn: () =>
      apiFetch<VolumeTrackingView | null>(`/contracts/${id}/volume-tracking`),
    enabled: Boolean(id),
  });

export const useRenewalCalendar = () =>
  useQuery({
    queryKey: contractKeys.renewals,
    queryFn: () => apiFetch<RenewalCalendarResponse>('/contracts/renewals/calendar'),
  });

export const useClauseLibrary = (clauseType?: string) =>
  useQuery({
    queryKey: contractKeys.library(clauseType ?? 'all'),
    queryFn: () =>
      apiFetch<ClauseLibraryItem[]>(
        `/contracts/clause-library${clauseType ? `?clauseType=${clauseType}` : ''}`,
      ),
  });

function invalidateAll(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: contractKeys.all });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ContractCreateInput) =>
      apiFetch<{ id: string }>('/contracts', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSubmitContract(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true }>(`/contracts/${id}/submit`, { method: 'POST' }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDecideContract(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { approvalId: string; decision: string; comment?: string }) =>
      apiFetch<{ ok: true }>(`/contracts/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useExecuteContract(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true; status: string }>(`/contracts/${id}/execute`, {
        method: 'POST',
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAmendContract(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AmendmentInput) =>
      apiFetch<{ id: string }>(`/contracts/${id}/amendments`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRenewContract(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { validityStart?: string; validityEnd?: string }) =>
      apiFetch<{ id: string }>(`/contracts/${id}/renew`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useTerminateContract(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TerminateInput) =>
      apiFetch<{ ok: true }>(`/contracts/${id}/terminate`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useApplyIndex(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { indexValue: string }) =>
      apiFetch<EscalationProposalResponse>(`/contracts/${id}/escalation/apply-index`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreateCallOff(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CallOffInput) =>
      apiFetch<{ id: string; poId: string }>(`/contracts/${id}/call-offs`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { alertId: string; body: AcknowledgeAlertInput }) =>
      apiFetch<{ ok: true }>(`/contracts/renewals/${v.alertId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify(v.body),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAddLibraryClause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClauseLibraryInput) =>
      apiFetch<{ id: string }>('/contracts/clause-library', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}
